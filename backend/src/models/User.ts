import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  avatar?: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  googleId?: string;
  githubId?: string;
  isVerified: boolean;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    avatar: { type: String },
    plan: { type: String, enum: ['free', 'pro', 'team', 'enterprise'], default: 'free' },
    googleId: { type: String },
    githubId: { type: String },
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String },
    verificationCodeExpires: { type: Date },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
