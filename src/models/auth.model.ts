import mongoose, { Document, Schema } from 'mongoose';

export interface IAuthSession extends Document {
  userId: mongoose.Types.ObjectId;
  refreshToken: string;
  deviceId: string;
  deviceInfo: {
    platform: string;
    os: string;
    appVersion: string;
  };
  lastActive: Date;
  expiresAt: Date;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const authSessionSchema = new Schema<IAuthSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refreshToken: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true },
    deviceInfo: {
      platform: { type: String, required: true },
      os: { type: String, required: true },
      appVersion: { type: String, required: true },
    },
    lastActive: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isValid: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
authSessionSchema.index({ userId: 1, deviceId: 1 });
authSessionSchema.index({ refreshToken: 1 });
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthSession = mongoose.model<IAuthSession>('AuthSession', authSessionSchema); 