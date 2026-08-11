import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (_req, res) => {
  const settings = await prisma.setting.findMany();
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
  res.json(map);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const entries = Object.entries(req.body as Record<string, string>);
  await Promise.all(entries.map(([key, value]) =>
    prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
  ));
  res.json({ message: 'Settings saved' });
});

export default router;
