import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

/**
 * Generate a unique invoice number
 * Format: STORE-BRANCH-FY-XXXX  e.g., INV-2526-0001
 */
export async function generateInvoiceNumber(branchId: string, prefix = 'INV'): Promise<string> {
  const now = dayjs();
  const fy = now.month() >= 3 ? `${now.year()}-${(now.year() + 1).toString().slice(2)}` : `${now.year() - 1}-${now.year().toString().slice(2)}`;

  // Count bills in current FY
  const fyStart = now.month() >= 3 ? dayjs(`${now.year()}-04-01`) : dayjs(`${now.year() - 1}-04-01`);
  const count = await prisma.bill.count({
    where: {
      branchId,
      createdAt: { gte: fyStart.toDate() },
    },
  });

  const seq = String(count + 1).padStart(4, '0');
  return `${prefix}/${fy}/${seq}`;
}
