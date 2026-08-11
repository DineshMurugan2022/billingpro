import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  gstNumber: z.string().optional(),
  creditLimit: z.number().min(0).default(0),
  gender: z.string().optional(),
  age: z.number().optional(),
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
      prisma.customer.findMany({ where, skip: (parseInt(page) - 1) * parseInt(limit), take: parseInt(limit), orderBy: { name: 'asc' } }),
      prisma.customer.count({ where }),
    ]);
    return res.json({ data: customers, total });
  } catch (err) {
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
      include: { bills: { take: 10, orderBy: { createdAt: 'desc' } }, creditTransactions: { take: 10, orderBy: { createdAt: 'desc' } } },
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
    if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = customerSchema.partial().parse(req.body);
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
    return res.json(customer);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
