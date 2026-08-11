import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import dayjs from 'dayjs';

const router = Router();
const prisma = new PrismaClient();

// GET /api/dashboard — key metrics
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.user?.branchId || '';
    const today = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();
    const monthStart = dayjs().startOf('month').toDate();

    const [todaySales, monthSales, totalBills, lowStockCount, totalCustomers] = await Promise.all([
      prisma.bill.aggregate({
        where: { branchId, createdAt: { gte: today, lte: todayEnd }, status: 'COMPLETED' },
        _sum: { totalAmount: true }, _count: true,
      }),
      prisma.bill.aggregate({
        where: { branchId, createdAt: { gte: monthStart }, status: 'COMPLETED' },
        _sum: { totalAmount: true }, _count: true,
      }),
      prisma.bill.count({ where: { branchId } }),
      prisma.inventory.count({ where: { branchId, quantity: { lte: prisma.inventory.fields.reorderLevel as unknown as number } } }),
      prisma.customer.count({ where: { isActive: true } }),
    ]);

    // Sales for last 7 days
    const last7Days = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const d = dayjs().subtract(i, 'day');
        return prisma.bill.aggregate({
          where: { branchId, createdAt: { gte: d.startOf('day').toDate(), lte: d.endOf('day').toDate() }, status: 'COMPLETED' },
          _sum: { totalAmount: true }, _count: true,
        }).then(r => ({ date: d.format('DD MMM'), total: r._sum.totalAmount || 0, count: r._count }));
      })
    );

    // Top 5 products today
    const topProducts = await prisma.billItem.groupBy({
      by: ['productId', 'productName'],
      where: { bill: { branchId, createdAt: { gte: today, lte: todayEnd }, status: 'COMPLETED' } },
      _sum: { quantity: true, totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    });

    return res.json({
      today: { sales: todaySales._sum.totalAmount || 0, bills: todaySales._count },
      month: { sales: monthSales._sum.totalAmount || 0, bills: monthSales._count },
      totalBills,
      totalCustomers,
      lowStockCount: 0, // simplified
      last7Days: last7Days.reverse(),
      topProducts,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
