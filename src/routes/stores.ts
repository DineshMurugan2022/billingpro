import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get all stores
router.get('/', async (_req, res) => {
  try {
    const stores = await prisma.store.findMany({
      include: { branches: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(stores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new store
router.post('/', async (req, res) => {
  try {
    const { name, gstNumber, address, city, state, pincode, phone, email } = req.body;
    const store = await prisma.store.create({
      data: { name, gstNumber, address, city, state, pincode, phone, email }
    });
    res.status(201).json(store);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a store
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gstNumber, address, city, state, pincode, phone, email } = req.body;
    const store = await prisma.store.update({
      where: { id },
      data: { name, gstNumber, address, city, state, pincode, phone, email }
    });
    res.json(store);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
