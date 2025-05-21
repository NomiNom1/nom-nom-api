import mongoose, { Document, Schema } from 'mongoose';

export interface IAddress extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
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

const addressSchema = new Schema<IAddress>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
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
  timestamps: true
});

// Compound indexes for common queries
addressSchema.index({ userId: 1, isDefault: 1 });
addressSchema.index({ userId: 1, addressType: 1 });
addressSchema.index({ location: '2dsphere' });
addressSchema.index({ city: 1, state: 1, country: 1 });

// Shard key for horizontal scaling
addressSchema.index({ userId: 1, _id: 1 });

// Add virtual id field for easier access
addressSchema.virtual('id').get(function(this: IAddress) {
  return this._id.toHexString();
});

// Ensure virtuals are included when converting to JSON
addressSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Address = mongoose.model<IAddress>('Address', addressSchema); 