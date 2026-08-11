import { PrismaClient, UserRole, GSTSlab } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Store
  const store = await prisma.store.upsert({
    where: { id: 'default-store' },
    update: {
      name: 'MERL DIAGNOSTICS',
      gstNumber: '33AAAAA0000A1Z5',
      address: 'OMR-Perungudi',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600096',
      phone: '+91 9876543210',
      email: 'info@merldiagnostics.com',
    },
    create: {
      id: 'default-store',
      name: 'MERL DIAGNOSTICS',
      gstNumber: '33AAAAA0000A1Z5',
      address: 'OMR-Perungudi',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600096',
      phone: '+91 9876543210',
      email: 'info@merldiagnostics.com',
    },
  });

  // Create Branch
  const branch = await prisma.branch.upsert({
    where: { id: 'default-branch' },
    update: {
      name: 'OMR-Perungudi',
      storeId: store.id,
      address: 'OMR-Perungudi, Chennai',
      phone: '+91 9876543210',
      gstNumber: '33AAAAA0000A1Z5',
    },
    create: {
      id: 'default-branch',
      name: 'OMR-Perungudi',
      storeId: store.id,
      address: 'OMR-Perungudi, Chennai',
      phone: '+91 9876543210',
      gstNumber: '33AAAAA0000A1Z5',
    },
  });

  // Create Admin User
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@billing.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@billing.com',
      password: hashedPassword,
      role: UserRole.ADMIN,
      branchId: branch.id,
    },
  });

  // Create Cashier
  const cashierPass = await bcrypt.hash('Cashier@123', 10);
  await prisma.user.upsert({
    where: { email: 'cashier@billing.com' },
    update: {},
    create: {
      name: 'Cashier One',
      email: 'cashier@billing.com',
      password: cashierPass,
      role: UserRole.CASHIER,
      branchId: branch.id,
    },
  });

  // Categories
  const cats = ['Biochemistry', 'Hematology', 'Pathology', 'Microbiology', 'Immunology', 'Radiology', 'Cardiology'];
  const categories: Record<string, string> = {};
  for (const name of cats) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories[name] = cat.id;
  }

  // Sample Products (Diagnostic Tests)
  const products = [
    { name: 'Glucose - Fasting', barcode: 'TEST001', categoryId: categories['Biochemistry'], mrp: 30, sellingPrice: 30, purchasePrice: 0, gstSlab: GSTSlab.ZERO, unit: 'TEST', hsnCode: '9993' },
    { name: 'Glucose - Post Prandial', barcode: 'TEST002', categoryId: categories['Biochemistry'], mrp: 30, sellingPrice: 30, purchasePrice: 0, gstSlab: GSTSlab.ZERO, unit: 'TEST', hsnCode: '9993' },
    { name: 'Complete Blood Count (CBC)', barcode: 'TEST003', categoryId: categories['Hematology'], mrp: 250, sellingPrice: 200, purchasePrice: 0, gstSlab: GSTSlab.ZERO, unit: 'TEST', hsnCode: '9993' },
    { name: 'Lipid Profile', barcode: 'TEST004', categoryId: categories['Biochemistry'], mrp: 400, sellingPrice: 350, purchasePrice: 0, gstSlab: GSTSlab.ZERO, unit: 'TEST', hsnCode: '9993' },
    { name: 'Thyroid Profile (T3, T4, TSH)', barcode: 'TEST005', categoryId: categories['Immunology'], mrp: 550, sellingPrice: 500, purchasePrice: 0, gstSlab: GSTSlab.ZERO, unit: 'TEST', hsnCode: '9993' },
    { name: 'HbA1c', barcode: 'TEST006', categoryId: categories['Biochemistry'], mrp: 400, sellingPrice: 350, purchasePrice: 0, gstSlab: GSTSlab.ZERO, unit: 'TEST', hsnCode: '9993' },
    { name: 'Vitamin D (25-OH)', barcode: 'TEST007', categoryId: categories['Biochemistry'], mrp: 1200, sellingPrice: 900, purchasePrice: 0, gstSlab: GSTSlab.ZERO, unit: 'TEST', hsnCode: '9993' },
    { name: 'Liver Function Test (LFT)', barcode: 'TEST008', categoryId: categories['Biochemistry'], mrp: 600, sellingPrice: 500, purchasePrice: 0, gstSlab: GSTSlab.ZERO, unit: 'TEST', hsnCode: '9993' },
    { name: 'Kidney Function Test (KFT)', barcode: 'TEST009', categoryId: categories['Biochemistry'], mrp: 600, sellingPrice: 500, purchasePrice: 0, gstSlab: GSTSlab.ZERO, unit: 'TEST', hsnCode: '9993' },
    { name: 'Urine Routine & Microscopy', barcode: 'TEST010', categoryId: categories['Pathology'], mrp: 150, sellingPrice: 120, purchasePrice: 0, gstSlab: GSTSlab.ZERO, unit: 'TEST', hsnCode: '9993' },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { barcode: p.barcode },
      update: { ...p, isActive: true, trackInventory: false },
      create: { ...p, isActive: true, trackInventory: false },
    });
    // Add inventory (tests don't technically need stock, but required by schema)
    await prisma.inventory.upsert({
      where: { productId_branchId: { productId: product.id, branchId: branch.id } },
      update: { quantity: 1000 },
      create: { productId: product.id, branchId: branch.id, quantity: 1000, reorderLevel: 10, reorderQuantity: 50 },
    });
  }

  // Sample Customer
  await prisma.customer.upsert({
    where: { phone: '9876500001' },
    update: { name: 'Mrs LAKSHMI', phone: '9876500001', email: 'lakshmi@example.com', city: 'Chennai', gender: 'Female', age: 53 },
    create: { name: 'Mrs LAKSHMI', phone: '9876500001', email: 'lakshmi@example.com', city: 'Chennai', loyaltyPoints: 50, gender: 'Female', age: 53 },
  });

  // Default settings
  const settings = [
    { key: 'store.name', value: 'MERL DIAGNOSTICS' },
    { key: 'store.gstin', value: '33AAAAA0000A1Z5' },
    { key: 'store.address', value: 'OMR-Perungudi, Chennai - 600096' },
    { key: 'store.phone', value: '+91 9876543210' },
    { key: 'invoice.prefix', value: 'INV' },
    { key: 'invoice.showGST', value: 'true' },
    { key: 'receipt.footer', value: 'Thank you for choosing MERL DIAGNOSTICS!' },
    { key: 'printer.type', value: 'none' },
    { key: 'currency.symbol', value: '₹' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }

  console.log('✅ Seed complete!');
  console.log('👤 Admin login: admin@billing.com / Admin@123');
  console.log('👤 Cashier login: cashier@billing.com / Cashier@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
