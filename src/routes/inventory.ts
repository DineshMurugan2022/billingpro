import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/inventory — stock list with low stock alert
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { lowStock, page = '1', limit = '20', search } = req.query as Record<string, string>;
    const branchId = req.user?.branchId || '';
    const where: Record<string, unknown> = { branchId };
    if (search) {
      where.product = { name: { contains: search, mode: 'insensitive' } };
    }
    const inventory = await prisma.inventory.findMany({
      where,
      include: { product: { include: { category: true } } },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    const result = inventory
      .filter(i => lowStock === 'true' ? i.quantity <= i.reorderLevel : true)
      .map(i => ({ ...i, isLowStock: i.quantity <= i.reorderLevel }));

    return res.json({ data: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/inventory/adjust — manual adjustment
router.post('/adjust', async (req: AuthRequest, res: Response) => {
  try {
    const { productId, quantity, type, notes } = req.body;
    const branchId = req.user?.branchId || '';
    const inv = await prisma.inventory.upsert({
      where: { productId_branchId: { productId, branchId } },
      update: { quantity: { increment: quantity } },
      create: { productId, branchId, quantity },
    });
    await prisma.stockMovement.create({
      data: { inventoryId: inv.id, type, quantity, balanceAfter: inv.quantity, notes },
    });
    return res.json(inv);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/inventory/:productId/reorder-level
router.put('/:productId/reorder-level', async (req: AuthRequest, res: Response) => {
  try {
    const { reorderLevel, reorderQuantity } = req.body;
    const branchId = req.user?.branchId || '';
    const inv = await prisma.inventory.update({
      where: { productId_branchId: { productId: req.params.productId, branchId } },
      data: { reorderLevel, reorderQuantity },
    });
    return res.json(inv);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/inventory/movements/:productId
router.get('/movements/:productId', async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.user?.branchId || '';
    const inv = await prisma.inventory.findUnique({
      where: { productId_branchId: { productId: req.params.productId, branchId } },
    });
    if (!inv) return res.json({ data: [] });
    const movements = await prisma.stockMovement.findMany({
      where: { inventoryId: inv.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ data: movements });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
