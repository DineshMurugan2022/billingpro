import { Router, Response } from 'express';
import { PrismaClient, GSTSlab, PaymentMode } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { calculateGST } from '../services/gstService';
import { io } from '../index';
import { generateInvoiceNumber } from '../services/invoiceService';

const router = Router();
const prisma = new PrismaClient();

const billItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
  sellingPrice: z.number().positive(),
  discountPercent: z.number().min(0).max(100).default(0),
  batchNumber: z.string().optional(),
});

const createBillSchema = z.object({
  customerId: z.string().optional(),
  items: z.array(billItemSchema).min(1),
  discountAmount: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  paymentMode: z.enum(['CASH', 'CARD', 'UPI', 'CREDIT', 'MIXED']).default('CASH'),
  cashAmount: z.number().min(0).default(0),
  cardAmount: z.number().min(0).default(0),
  upiAmount: z.number().min(0).default(0),
  creditAmount: z.number().min(0).default(0),
  loyaltyPointsUsed: z.number().min(0).default(0),
  notes: z.string().optional(),
  receivedBy: z.string().optional(),
  isIGST: z.boolean().default(false), // inter-state GST
});

// GET /api/billing — list bills
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20', search, startDate, endDate, status } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: Record<string, unknown> = {};
    if (req.user?.branchId) where.branchId = req.user.branchId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate + 'T23:59:59.999Z') }),
      };
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: { customer: true, cashier: { select: { name: true } }, _count: { select: { items: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bill.count({ where }),
    ]);
    return res.json({ data: bills, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/billing/:id — single bill
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        cashier: { select: { name: true } },
        branch: { include: { store: true } },
        items: { include: { product: true } },
      },
    });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    return res.json(bill);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/billing — create new bill
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createBillSchema.parse(req.body);
    const branchId = req.user?.branchId || '';

    // Fetch all products
    const products = await prisma.product.findMany({
      where: { id: { in: data.items.map(i => i.productId) } },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    // Calculate bill
    let subtotal = 0;
    let totalCgst = 0, totalSgst = 0, totalIgst = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const billItems: any[] = [];

    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);

      const lineTotal = item.sellingPrice * item.quantity;
      const discountAmt = (lineTotal * item.discountPercent) / 100;
      const taxableAmt = lineTotal - discountAmt;
      const gstCalc = calculateGST(taxableAmt, product.gstSlab as GSTSlab, product.taxType as 'INCLUSIVE' | 'EXCLUSIVE', data.isIGST);

      subtotal += lineTotal;
      totalCgst += gstCalc.cgst;
      totalSgst += gstCalc.sgst;
      totalIgst += gstCalc.igst;

      billItems.push({
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        hsnCode: product.hsnCode,
        unit: product.unit,
        quantity: item.quantity,
        mrp: product.mrp,
        sellingPrice: item.sellingPrice,
        discountPercent: item.discountPercent,
        discountAmount: discountAmt,
        taxableAmount: gstCalc.taxableAmount,
        gstSlab: product.gstSlab,
        cgstPercent: gstCalc.cgstPercent,
        sgstPercent: gstCalc.sgstPercent,
        igstPercent: gstCalc.igstPercent,
        cgstAmount: gstCalc.cgst,
        sgstAmount: gstCalc.sgst,
        igstAmount: gstCalc.igst,
        totalAmount: gstCalc.total,
        batchNumber: item.batchNumber,
      });
    }

    const taxableAmount = subtotal - data.discountAmount;
    const totalTax = totalCgst + totalSgst + totalIgst;
    const grossTotal = taxableAmount + totalTax;
    const roundOff = Math.round(grossTotal) - grossTotal;
    const totalAmount = Math.round(grossTotal);
    const changeAmount = Math.max(0, data.cashAmount - totalAmount);

    // Loyalty points: 1 point per 100 rupees
    const loyaltyPointsEarned = Math.floor(totalAmount / 100);

    const invoiceNumber = await generateInvoiceNumber(branchId);

    const bill = await prisma.$transaction(async (tx) => {
      // Create bill
      const newBill = await tx.bill.create({
        data: {
          invoiceNumber,
          branchId,
          customerId: data.customerId,
          cashierId: req.user!.id,
          subtotal,
          discountAmount: data.discountAmount,
          discountPercent: data.discountPercent,
          taxableAmount,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          totalTax,
          roundOff,
          totalAmount,
          paymentMode: data.paymentMode as PaymentMode,
          cashAmount: data.cashAmount,
          cardAmount: data.cardAmount,
          upiAmount: data.upiAmount,
          creditAmount: data.creditAmount,
          changeAmount,
          loyaltyPointsEarned,
          loyaltyPointsUsed: data.loyaltyPointsUsed,
          notes: data.notes,
          receivedBy: data.receivedBy,
          items: { create: billItems },
        },
        include: { items: true, customer: true, branch: { include: { store: true } } },
      });

      // Deduct inventory
      for (const item of data.items) {
        const inv = await tx.inventory.findUnique({
          where: { productId_branchId: { productId: item.productId, branchId } },
        });
        if (inv && productMap.get(item.productId)?.trackInventory) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: { decrement: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              inventoryId: inv.id,
              type: 'SALE',
              quantity: -item.quantity,
              balanceAfter: inv.quantity - item.quantity,
              reference: newBill.invoiceNumber,
            },
          });
        }
      }

      // Update customer loyalty & credit
      if (data.customerId) {
        await tx.customer.update({
          where: { id: data.customerId },
          data: {
            loyaltyPoints: { increment: loyaltyPointsEarned - data.loyaltyPointsUsed },
            currentCredit: { increment: data.creditAmount },
          },
        });
      }

      return newBill;
    });

    // Real-time broadcast
    io.to(`branch:${branchId}`).emit('bill:created', { invoiceNumber: bill.invoiceNumber, total: bill.totalAmount });

    return res.status(201).json(bill);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: err.errors });
    console.error(err);
    return res.status(500).json({ message: (err as Error).message || 'Server error' });
  }
});

// POST /api/billing/:id/return — process return
router.post('/:id/return', async (req: AuthRequest, res: Response) => {
  try {
    const originalBill = await prisma.bill.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!originalBill) return res.status(404).json({ message: 'Bill not found' });

    const branchId = req.user?.branchId || '';
    const invoiceNumber = await generateInvoiceNumber(branchId, 'RTN');

    const returnBill = await prisma.bill.create({
      data: {
        invoiceNumber,
        branchId,
        cashierId: req.user!.id,
        customerId: originalBill.customerId,
        originalBillId: originalBill.id,
        subtotal: -originalBill.subtotal,
        taxableAmount: -originalBill.taxableAmount,
        cgstAmount: -originalBill.cgstAmount,
        sgstAmount: -originalBill.sgstAmount,
        totalTax: -originalBill.totalTax,
        totalAmount: -originalBill.totalAmount,
        paymentMode: 'CASH',
        cashAmount: -originalBill.totalAmount,
        status: 'RETURN',
        notes: `Return against ${originalBill.invoiceNumber}`,
      },
    });

    return res.status(201).json(returnBill);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
