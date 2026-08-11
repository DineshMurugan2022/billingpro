import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// POS Hardware routes — printer, cash drawer
// Thermal printer is skipped per user request (no printer yet)
// These endpoints are ready for when printer is added

// GET /api/pos-hardware/status
router.get('/status', async (_req: AuthRequest, res: Response) => {
  return res.json({
    printer: { connected: false, message: 'No printer configured yet' },
    cashDrawer: { connected: false },
    scanner: { type: 'USB-HID Keyboard Wedge', notes: 'Barcode scanner acts as keyboard input — no config needed' },
  });
});

// POST /api/pos-hardware/print-receipt
router.post('/print-receipt', async (req: AuthRequest, res: Response) => {
  try {
    // TODO: When thermal printer is available, uncomment and configure:
    // const printer = new ThermalPrinter({
    //   type: PrinterTypes.EPSON,
    //   interface: process.env.PRINTER_INTERFACE || 'tcp://192.168.1.100:9100',
    // });
    // await printer.printReceipt(req.body);

    console.log('[POS] Print receipt requested:', req.body.invoiceNumber);
    return res.json({ success: false, message: 'Printer not configured. Please add printer settings in Settings > Hardware.' });
  } catch (err) {
    return res.status(500).json({ message: 'Printer error' });
  }
});

// POST /api/pos-hardware/open-drawer
router.post('/open-drawer', async (_req: AuthRequest, res: Response) => {
  try {
    // TODO: Trigger cash drawer via ESC/POS command when printer is configured
    console.log('[POS] Cash drawer open requested');
    return res.json({ success: false, message: 'Cash drawer not configured' });
  } catch (err) {
    return res.status(500).json({ message: 'Drawer error' });
  }
});

export default router;
