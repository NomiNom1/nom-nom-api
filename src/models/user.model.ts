import mongoose, { Document, Schema } from 'mongoose';

export interface IAddress extends Document {
  id: string;
  label: string;
  street: string;
  apartment?: string;
  buildingName?: string;
  entryCode?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  location: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  dropOffOptions: {
    handItToMe: boolean;
    leaveAtDoor: boolean;
  };
  instructions?: string;
  isDefault: boolean;
  addressType: 'home' | 'work' | 'custom';
  createdAt: Date;
  updatedAt: Date;
}

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
  addresses: IAddress[];
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

const addressSchema = new Schema<IAddress>({
  id: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  street: { type: String, required: true },
  apartment: { type: String },
  buildingName: { type: String },
  entryCode: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'US' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  dropOffOptions: {
    handItToMe: { type: Boolean, default: false },
    leaveAtDoor: { type: Boolean, default: false },
  },
  instructions: { type: String },
  isDefault: { type: Boolean, default: false },
  addressType: { 
    type: String, 
    enum: ['home', 'work', 'custom'],
    required: true 
  }
}, {
  timestamps: true,
  _id: false
});

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
    addresses: [addressSchema],
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

// Update indexes for better scalability
userSchema.index({ 'addresses.id': 1 });
userSchema.index({ 'addresses.location': '2dsphere' });
userSchema.index({ 'addresses.city': 1 });
userSchema.index({ 'addresses.state': 1 });
userSchema.index({ 'addresses.country': 1 });
userSchema.index({ 'addresses.addressType': 1 });
userSchema.index({ 'addresses.isDefault': 1 });
userSchema.index({ email: 1 });
userSchema.index({ phone: 1, countryCode: 1 }, { unique: true });
userSchema.index({ countryCode: 1 });

export const User = mongoose.model<IUser>('User', userSchema); 