import { PrismaClient, UserRole, GSTSlab } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface PdfProduct {
  serviceId: string;
  name: string;
  b2bPrice: number;
  b2cPrice: number;
  discount: number;
}

function getCategoryName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('x-ray') || n.includes('ct ') || n.includes('mri ') || n.includes('usg') || n.includes('doppler') || n.includes('scan')) {
    return 'Radiology';
  }
  if (n.includes('ecg') || n.includes('echo') || n.includes('tmt') || n.includes('cardiac')) {
    return 'Cardiology';
  }
  if (n.includes('culture') || n.includes('stain') || n.includes('fungus') || n.includes('bacteria') || n.includes('tb ') || n.includes('microbiology')) {
    return 'Microbiology';
  }
  if (n.includes('antibody') || n.includes('immun') || n.includes('ana') || n.includes('hiv') || n.includes('hbs') || n.includes('hcv') || n.includes('igg') || n.includes('igm') || n.includes('iga')) {
    return 'Immunology';
  }
  if (n.includes('lymphocyte') || n.includes('blood') || n.includes('coombs') || n.includes('thromboplastin') || n.includes('cbc') || n.includes('hemoglobin') || n.includes('neutrophil') || n.includes('platelet') || n.includes('anemia')) {
    return 'Hematology';
  }
  if (n.includes('glucose') || n.includes('bilirubin') || n.includes('phosphorus') || n.includes('copper') || n.includes('creatinine') || n.includes('protein') || n.includes('albumin') || n.includes('anion') || n.includes('apolipoprotein') || n.includes('calcium') || n.includes('chloride') || n.includes('potassium') || n.includes('sodium') || n.includes('electrolytes') || n.includes('urea') || n.includes('lipid') || n.includes('thyroid') || n.includes('lft') || n.includes('kft')) {
    return 'Biochemistry';
  }
  return 'Pathology';
}

async function main() {
  console.log('🌱 Seeding database with MERL DIAGNOSTICS product details...');

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
  await prisma.user.upsert({
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
  const catNames = ['Biochemistry', 'Hematology', 'Pathology', 'Microbiology', 'Immunology', 'Radiology', 'Cardiology'];
  const categoryMap: Record<string, string> = {};
  for (const name of catNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoryMap[name] = cat.id;
  }

  // Sample Customer (Mrs LAKSHMI)
  await prisma.customer.upsert({
    where: { phone: '9876500001' },
    update: { name: 'Mrs LAKSHMI', phone: '9876500001', email: '', city: 'Chennai', gender: 'Female', age: 53 },
    create: { name: 'Mrs LAKSHMI', phone: '9876500001', email: '', city: 'Chennai', loyaltyPoints: 50, gender: 'Female', age: 53 },
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

  // Read products JSON
  const jsonPath = path.join(__dirname, 'pdf_products.json');
  if (fs.existsSync(jsonPath)) {
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const pdfProducts: PdfProduct[] = JSON.parse(rawData);

    console.log(`📦 Seeding ${pdfProducts.length} products from PDF...`);

    let count = 0;
    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < pdfProducts.length; i += batchSize) {
      const chunk = pdfProducts.slice(i, i + batchSize);
      await Promise.all(
        chunk.map(async (item) => {
          const catName = getCategoryName(item.name);
          const categoryId = categoryMap[catName] || categoryMap['Pathology'];
          const mrp = item.b2cPrice > 0 ? item.b2cPrice : (item.b2bPrice > 0 ? item.b2bPrice : 100);
          const sellingPrice = item.b2bPrice > 0 ? item.b2bPrice : mrp;

          const barcode = item.serviceId;
          const sku = `SRV-${item.serviceId}`;

          const product = await prisma.product.upsert({
            where: { barcode },
            update: {
              name: item.name,
              mrp,
              sellingPrice,
              purchasePrice: 0,
              gstSlab: GSTSlab.ZERO,
              unit: 'TEST',
              hsnCode: '9993',
              categoryId,
              isActive: true,
              trackInventory: false,
            },
            create: {
              name: item.name,
              barcode,
              sku,
              mrp,
              sellingPrice,
              purchasePrice: 0,
              gstSlab: GSTSlab.ZERO,
              unit: 'TEST',
              hsnCode: '9993',
              categoryId,
              isActive: true,
              trackInventory: false,
            },
          });

          await prisma.inventory.upsert({
            where: { productId_branchId: { productId: product.id, branchId: branch.id } },
            update: { quantity: 1000 },
            create: { productId: product.id, branchId: branch.id, quantity: 1000, reorderLevel: 10, reorderQuantity: 50 },
          });
        })
      );
      count += chunk.length;
      if (count % 500 === 0 || count === pdfProducts.length) {
        console.log(`   Upserted ${count}/${pdfProducts.length} products...`);
      }
    }
    console.log(`✅ Successfully seeded ${count} products into database!`);
  } else {
    console.warn(`⚠️ File ${jsonPath} not found!`);
  }

  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
