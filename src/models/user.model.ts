import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  password?: string;
  profilePhoto?: {
    url: string;
    thumbnailUrl?: string;
  };
  deliveryAddresses: Array<{
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    location: {
      type: string;
      coordinates: [number, number];
    };
    isDefault: boolean;
  }>;
  paymentMethods: Array<{
    type: string;
    cardNumber: string;
    expiryDate: string;
    cardHolderName: string;
    isDefault: boolean;
  }>;
  orderHistory: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    countryCode: { type: String, required: true, default: 'US' },
    password: { type: String, required: false },
    profilePhoto: {
      url: String,
      thumbnailUrl: String,
    },
    deliveryAddresses: [{
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true, default: 'US' },
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true },
      },
      isDefault: { type: Boolean, default: false },
    }],
    paymentMethods: [{
      type: { type: String, required: true },
      cardNumber: { type: String, required: true },
      expiryDate: { type: String, required: true },
      cardHolderName: { type: String, required: true },
      isDefault: { type: Boolean, default: false },
    }],
    orderHistory: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
userSchema.index({ 'deliveryAddresses.location': '2dsphere' });
userSchema.index({ email: 1 });
userSchema.index({ phone: 1, countryCode: 1 }, { unique: true });
userSchema.index({ countryCode: 1 });

export const User = mongoose.model<IUser>('User', userSchema); 