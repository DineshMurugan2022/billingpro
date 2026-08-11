import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' }, take: 100 });
  res.json(expenses);
});

router.post('/', async (req, res) => {
  try {
    const expense = await prisma.expense.create({ data: req.body });
    res.status(201).json(expense);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

export default router;
