import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';

import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import unitsRoutes from './routes/units.routes';
import departmentsRoutes from './routes/departments.routes';
import ticketRoutes from './routes/tickets.routes';
import categoryRoutes from './routes/categories.routes';
import notificationRoutes from './routes/notifications.routes';
import assetRoutes from './routes/assets.routes';
import analyticsRoutes from './routes/analytics.routes';
import reportsRoutes from './routes/reports.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import servicesRoutes from './routes/services.routes';
import employeesRoutes from './routes/employees.routes';
import settingsRoutes from './routes/settings.routes';
import publicRoutes from './routes/public.routes';
import routingRoutes from './routes/routing.routes';

const app: Express = express();

// Security middlewares
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const configuredOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());
    if (
      configuredOrigins.includes('*') ||
      configuredOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));

// Parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check routes
app.get(['/api/v1/health', '/api/health', '/health', '/'], (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'DeskPulse API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Helper to register routes across multiple prefixes (/api/v1, /api, and root /)
const registerRoutes = (prefix: string) => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/users`, usersRoutes);
  app.use(`${prefix}/units`, unitsRoutes);
  app.use(`${prefix}/departments`, departmentsRoutes);
  app.use(`${prefix}/tickets`, ticketRoutes);
  app.use(`${prefix}/categories`, categoryRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(`${prefix}/assets`, assetRoutes);
  app.use(`${prefix}/analytics`, analyticsRoutes);
  app.use(`${prefix}/reports`, reportsRoutes);
  app.use(`${prefix}/knowledge`, knowledgeRoutes);
  app.use(`${prefix}/services`, servicesRoutes);
  app.use(`${prefix}/employees`, employeesRoutes);
  app.use(`${prefix}/settings`, settingsRoutes);
  app.use(`${prefix}/public`, publicRoutes);
  app.use(`${prefix}/routing`, routingRoutes);
};

// Mount API routes
registerRoutes('/api/v1');
registerRoutes('/api');
registerRoutes('');

// 404 handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    status: 'error',
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;
