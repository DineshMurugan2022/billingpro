import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  hsnCode: z.string().optional(),
  categoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
  mrp: z.number().positive(),
  sellingPrice: z.number().positive(),
  purchasePrice: z.number().optional(),
  gstSlab: z.enum(['ZERO', 'FIVE', 'TWELVE', 'EIGHTEEN', 'TWENTYEIGHT']).default('ZERO'),
  taxType: z.enum(['INCLUSIVE', 'EXCLUSIVE']).default('INCLUSIVE'),
  unit: z.string().default('PCS'),
  secondaryUnit: z.string().optional(),
  conversionFactor: z.number().optional(),
  trackInventory: z.boolean().default(true),
  hasBatch: z.boolean().default(false),
});

// GET /api/products
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, categoryId, isActive, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        skip,
        take: parseInt(limit),
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);
    return res.json({ data: products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/products/barcode/:barcode
router.get('/barcode/:barcode', async (req: AuthRequest, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { barcode: req.params.barcode },
      include: { category: true, inventory: { where: { branchId: req.user?.branchId ?? '' } } },
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.json(product);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { category: true, inventory: true, batches: true },
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    return res.json(product);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/products
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({ data });
    return res.status(201).json(product);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: err.errors });
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/products/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    return res.json(product);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: err.errors });
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/products/:id (soft delete)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ message: 'Product deactivated' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
