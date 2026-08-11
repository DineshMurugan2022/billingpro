import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/categories
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: { _count: { select: { products: true } }, subCategories: true },
      orderBy: { name: 'asc' },
    });
    return res.json(categories);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = z.object({ name: z.string(), description: z.string().optional() }).parse(req.body);
    const cat = await prisma.category.create({ data: { name, description } });
    return res.status(201).json(cat);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = z.object({ name: z.string().optional(), description: z.string().optional() }).parse(req.body);
    const cat = await prisma.category.update({ where: { id: req.params.id }, data });
    return res.json(cat);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ message: 'Category deactivated' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
