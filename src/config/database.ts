import mongoose from 'mongoose';
import { logger } from '../utils/logger';

// const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/nom-nom';
const MONGODB_URI = "mongodb+srv://admin:admin@nomi-nom.mtb8d1q.mongodb.net/nomi-nom?retryWrites=true&w=majority&appName=Nomi-Nom";


export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info(`MongoDB connected successfully using ${MONGODB_URI}`);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
}); 