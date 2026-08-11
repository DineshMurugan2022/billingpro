import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Suppliers
router.get('/', async (_req, res) => {
  const suppliers = await prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  res.json(suppliers);
});
router.post('/', async (req, res) => {
  try {
    const supplier = await prisma.supplier.create({ data: req.body });
    res.status(201).json(supplier);
  } catch { res.status(500).json({ message: 'Server error' }); }
});
router.put('/:id', async (req, res) => {
  try {
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: req.body });
    res.json(supplier);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// Purchase Orders
router.get('/purchase-orders', async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.post('/purchase-orders', async (req: AuthRequest, res: Response) => {
  try {
    const { supplierId, items, notes, expectedDate } = req.body;
    const totalAmount = items.reduce((sum: number, i: { orderedQty: number; purchasePrice: number }) => sum + i.orderedQty * i.purchasePrice, 0);
    const count = await prisma.purchaseOrder.count();
    const poNumber = `PO/${new Date().getFullYear()}/${String(count + 1).padStart(4, '0')}`;
    const order = await prisma.purchaseOrder.create({
      data: { poNumber, supplierId, userId: req.user!.id, totalAmount, notes, expectedDate: expectedDate ? new Date(expectedDate) : undefined, items: { create: items } },
      include: { supplier: true, items: { include: { product: true } } },
    });
    res.status(201).json(order);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// Receive Purchase Order (update inventory)
router.post('/purchase-orders/:id/receive', async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body; // [{purchaseItemId, receivedQty}]
    const branchId = req.user?.branchId || '';
    const order = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await prisma.$transaction(async (tx) => {
      for (const recv of items) {
        const poItem = order.items.find(i => i.id === recv.purchaseItemId);
        if (!poItem) continue;
        await tx.purchaseItem.update({ where: { id: recv.purchaseItemId }, data: { receivedQty: { increment: recv.receivedQty } } });
        const inv = await tx.inventory.upsert({
          where: { productId_branchId: { productId: poItem.productId, branchId } },
          update: { quantity: { increment: recv.receivedQty } },
          create: { productId: poItem.productId, branchId, quantity: recv.receivedQty },
        });
        await tx.stockMovement.create({
          data: { inventoryId: inv.id, type: 'PURCHASE', quantity: recv.receivedQty, balanceAfter: inv.quantity, reference: order.poNumber },
        });
      }
      await tx.purchaseOrder.update({ where: { id: req.params.id }, data: { status: 'RECEIVED', receivedDate: new Date() } });
    });
    return res.json({ message: 'Stock received successfully' });
  } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }); }
});

export default router;
