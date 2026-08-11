import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { Server as SocketServer } from 'socket.io';

import authRouter from './routes/auth';
import productsRouter from './routes/products';
import categoriesRouter from './routes/categories';
import inventoryRouter from './routes/inventory';
import billingRouter from './routes/billing';
import customersRouter from './routes/customers';
import suppliersRouter from './routes/suppliers';
import reportsRouter from './routes/reports';
import posHardwareRouter from './routes/posHardware';
import settingsRouter from './routes/settings';
import dashboardRouter from './routes/dashboard';
import branchesRouter from './routes/branches';
import storesRouter from './routes/stores';
import usersRouter from './routes/users';
import expensesRouter from './routes/expenses';

import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';

const app = express();
const httpServer = http.createServer(app);

// ─── Socket.io for real-time sync ───────────────────
export const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`📡 Socket connected: ${socket.id}`);
  socket.on('join-branch', (branchId: string) => {
    socket.join(`branch:${branchId}`);
  });
  socket.on('disconnect', () => {
    console.log(`📡 Socket disconnected: ${socket.id}`);
  });
});

// ─── Middleware ──────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, '');
    const targetUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    
    if (
      !targetUrl ||
      cleanOrigin === targetUrl ||
      cleanOrigin.endsWith('.vercel.app') ||
      cleanOrigin.includes('localhost')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Health Check ────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Public Routes ───────────────────────────────────
app.use(['/api/auth', '/auth'], authRouter);

// ─── Protected Routes ────────────────────────────────
app.use(['/api/dashboard', '/dashboard'], authenticate, dashboardRouter);
app.use(['/api/products', '/products'], authenticate, productsRouter);
app.use(['/api/categories', '/categories'], authenticate, categoriesRouter);
app.use(['/api/inventory', '/inventory'], authenticate, inventoryRouter);
app.use(['/api/billing', '/billing'], authenticate, billingRouter);
app.use(['/api/customers', '/customers'], authenticate, customersRouter);
app.use(['/api/suppliers', '/suppliers'], authenticate, suppliersRouter);
app.use(['/api/reports', '/reports'], authenticate, reportsRouter);
app.use(['/api/pos-hardware', '/pos-hardware'], authenticate, posHardwareRouter);
app.use(['/api/settings', '/settings'], authenticate, settingsRouter);
app.use(['/api/stores', '/stores'], authenticate, storesRouter);
app.use(['/api/branches', '/branches'], authenticate, branchesRouter);
app.use(['/api/users', '/users'], authenticate, usersRouter);
app.use(['/api/expenses', '/expenses'], authenticate, expensesRouter);

// ─── Error Handler ───────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10);
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Billing Server running at http://localhost:${PORT}`);
  console.log(`📊 API Docs: http://localhost:${PORT}/api`);
  console.log(`🔌 Socket.io: ws://localhost:${PORT}\n`);
});

export default app;
