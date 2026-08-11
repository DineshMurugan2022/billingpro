import { GSTSlab } from '@prisma/client';

const GST_RATES: Record<GSTSlab, number> = {
  ZERO: 0,
  FIVE: 5,
  TWELVE: 12,
  EIGHTEEN: 18,
  TWENTYEIGHT: 28,
};

export interface GSTResult {
  taxableAmount: number;
  gstRate: number;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  total: number;
}

/**
 * Calculate GST for a given amount
 * @param amount - The line total (qty * price) or taxable amount
 * @param slab - GST slab (ZERO, FIVE, TWELVE, EIGHTEEN, TWENTYEIGHT)
 * @param taxType - INCLUSIVE (MRP includes GST) or EXCLUSIVE (GST added on top)
 * @param isIGST - true for inter-state (IGST), false for intra-state (CGST+SGST)
 */
export function calculateGST(
  amount: number,
  slab: GSTSlab,
  taxType: 'INCLUSIVE' | 'EXCLUSIVE',
  isIGST = false
): GSTResult {
  const gstRate = GST_RATES[slab];
  let taxableAmount: number;
  let totalTax: number;

  if (taxType === 'INCLUSIVE') {
    // Extract GST from inclusive price
    taxableAmount = amount / (1 + gstRate / 100);
    totalTax = amount - taxableAmount;
  } else {
    // Add GST on top
    taxableAmount = amount;
    totalTax = (amount * gstRate) / 100;
  }

  let cgst = 0, sgst = 0, igst = 0;
  let cgstPercent = 0, sgstPercent = 0, igstPercent = 0;

  if (isIGST) {
    igst = totalTax;
    igstPercent = gstRate;
  } else {
    cgst = totalTax / 2;
    sgst = totalTax / 2;
    cgstPercent = gstRate / 2;
    sgstPercent = gstRate / 2;
  }

  return {
    taxableAmount: round2(taxableAmount),
    gstRate,
    cgstPercent,
    sgstPercent,
    igstPercent,
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    totalTax: round2(totalTax),
    total: round2(amount),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Validate GSTIN format (Indian GST Number)
 */
export function validateGSTIN(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.toUpperCase());
}

/**
 * Get state code from GSTIN (first 2 digits)
 */
export function getStateFromGSTIN(gstin: string): string {
  const stateCodes: Record<string, string> = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
    '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
    '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
    '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
    '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
    '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra',
    '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
    '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
    '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana',
    '37': 'Andhra Pradesh (New)', '38': 'Ladakh',
  };
  return stateCodes[gstin.substring(0, 2)] || 'Unknown';
}
