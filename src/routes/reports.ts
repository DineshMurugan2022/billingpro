import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import dayjs from 'dayjs';

const router = Router();
const prisma = new PrismaClient();

// GET /api/reports/sales?startDate=&endDate=
router.get('/sales', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query as Record<string, string>;
    const branchId = req.user?.branchId || '';
    const where = {
      branchId,
      status: 'COMPLETED' as const,
      createdAt: {
        gte: startDate ? new Date(startDate) : dayjs().subtract(30, 'day').toDate(),
        lte: endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date(),
      },
    };
    const bills = await prisma.bill.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate by day
    const grouped: Record<string, { date: string; sales: number; bills: number; tax: number }> = {};
    for (const bill of bills) {
      const key = dayjs(bill.createdAt).format('YYYY-MM-DD');
      if (!grouped[key]) grouped[key] = { date: dayjs(bill.createdAt).format('DD MMM'), sales: 0, bills: 0, tax: 0 };
      grouped[key].sales += bill.totalAmount;
      grouped[key].bills += 1;
      grouped[key].tax += bill.totalTax;
    }

    const totalSales = bills.reduce((s, b) => s + b.totalAmount, 0);
    const totalTax = bills.reduce((s, b) => s + b.totalTax, 0);

    return res.json({ summary: { totalSales, totalTax, totalBills: bills.length }, data: Object.values(grouped) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/reports/gstr1 — GSTR-1 style report
router.get('/gstr1', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    const branchId = req.user?.branchId || '';
    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const items = await prisma.billItem.findMany({
      where: { bill: { branchId, createdAt: { gte: startDate, lte: endDate }, status: 'COMPLETED' } },
    });

    // Group by HSN code
    const hsnWise: Record<string, { hsnCode: string; taxableAmount: number; cgst: number; sgst: number; igst: number }> = {};
    for (const item of items) {
      const key = item.hsnCode || 'NO_HSN';
      if (!hsnWise[key]) hsnWise[key] = { hsnCode: key, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0 };
      hsnWise[key].taxableAmount += item.taxableAmount;
      hsnWise[key].cgst += item.cgstAmount;
      hsnWise[key].sgst += item.sgstAmount;
      hsnWise[key].igst += item.igstAmount;
    }

    return res.json({ data: Object.values(hsnWise) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/reports/stock-valuation
router.get('/stock-valuation', async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.user?.branchId || '';
    const inventory = await prisma.inventory.findMany({
      where: { branchId },
      include: { product: { select: { name: true, purchasePrice: true, sellingPrice: true, unit: true } } },
    });
    const data = inventory.map(i => ({
      product: i.product.name,
      unit: i.product.unit,
      quantity: i.quantity,
      purchaseValue: i.quantity * (i.product.purchasePrice || 0),
      sellingValue: i.quantity * i.product.sellingPrice,
    }));
    return res.json({ data, totalPurchaseValue: data.reduce((s, d) => s + d.purchaseValue, 0) });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/reports/top-products
router.get('/top-products', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '10', startDate, endDate } = req.query as Record<string, string>;
    const branchId = req.user?.branchId || '';
    const products = await prisma.billItem.groupBy({
      by: ['productId', 'productName'],
      where: { bill: { branchId, status: 'COMPLETED', createdAt: { gte: startDate ? new Date(startDate) : dayjs().subtract(30, 'day').toDate() } } },
      _sum: { quantity: true, totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: parseInt(limit),
    });
    return res.json(products);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
