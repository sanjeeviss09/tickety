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
  origin: env.CORS_ORIGIN,
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

// Health check route
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'DeskPulse API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/units', unitsRoutes);
app.use('/api/v1/departments', departmentsRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/knowledge', knowledgeRoutes);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/employees', employeesRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/routing', routingRoutes);

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
