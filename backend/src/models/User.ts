import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  avatar?: string;
  bio?: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  role: 'user' | 'admin' | 'superadmin';
  status: 'active' | 'suspended' | 'pending';
  googleId?: string;
  githubId?: string;
  isVerified: boolean;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  tokenVersion: number;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    avatar: { type: String },
    bio: { type: String },
    plan: { type: String, enum: ['free', 'pro', 'team', 'enterprise'], default: 'free' },
    role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user', index: true },
    status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'active', index: true },
    googleId: { type: String },
    githubId: { type: String },
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String },
    verificationCodeExpires: { type: Date },
    tokenVersion: { type: Number, default: 0 },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
