import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const { storeId } = req.query;
  const where = storeId ? { storeId: String(storeId) } : {};
  const branches = await prisma.branch.findMany({ where, include: { store: true }, orderBy: { createdAt: 'desc' } });
  res.json(branches);
});

router.post('/', async (req, res) => {
  try {
    const branch = await prisma.branch.create({ data: req.body });
    res.status(201).json(branch);
  } catch (error) { 
    console.error(error);
    res.status(500).json({ message: 'Server error' }); 
  }
});

router.put('/:id', async (req, res) => {
  try {
    const branch = await prisma.branch.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(branch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
