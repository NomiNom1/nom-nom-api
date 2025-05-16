import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { connectDB } from './config/database';
import userRoutes from './routes/user.routes';
import authRoutes from './routes/auth.routes';
import phoneVerificationRoutes from './routes/phone-verification.routes';
import locationRoutes from './routes/location.routes';
import { logger } from './utils/logger';

const app = express();

console.log(process.env.TWILIO_ACCOUNT_SID)
//TODO: 
// Use Redis for storing email tokens and rate limiting
// Use a proper email service (SendGrid, AWS SES, etc.)
// Use secure secrets management
// Implement rate limiting
// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(compression()); // Compress responses
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/phone-verification', phoneVerificationRoutes);
app.use('/api/location', locationRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Start server
const PORT = process.env.PORT ?? 3000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 