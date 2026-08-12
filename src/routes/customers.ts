import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z
    .string()
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  email: z
    .string()
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  creditLimit: z.preprocess((v) => (v === '' || v === null || v === undefined ? 0 : Number(v)), z.number().min(0)).default(0),
  gender: z.string().optional().nullable(),
  age: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().nullable().optional()
  ),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const where: Record<string, unknown> = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);
    return res.json({ data: customers, total });
  } catch (err) {
    console.error('Customer list error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/phone/:phone', async (req: AuthRequest, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { phone: req.params.phone } });
    return res.json(customer);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        bills: { take: 10, orderBy: { createdAt: 'desc' } },
        creditTransactions: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    return res.json(customer);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = customerSchema.parse(req.body);
    const customer = await prisma.customer.create({ data });
    return res.status(201).json(customer);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: err.errors });
    console.error('Customer create error:', err);
    return res.status(500).json({ message: (err as Error).message || 'Server error' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id, createdAt, updatedAt, loyaltyPoints, currentCredit, creditTransactions, bills, ...rest } = req.body;
    const data = customerSchema.partial().parse(rest);
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
    return res.json(customer);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: err.errors });
    console.error('Customer update error:', err);
    return res.status(500).json({ message: (err as Error).message || 'Server error' });
  }
});

export default router;
