import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, branchId: true, isActive: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

router.post('/', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role, branchId } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role, branchId },
      select: { id: true, name: true, email: true, role: true, branchId: true },
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { password, ...rest } = req.body;
    const data: Record<string, unknown> = { ...rest };
    if (password) data.password = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({ where: { id: req.params.id }, data, select: { id: true, name: true, email: true, role: true } });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
