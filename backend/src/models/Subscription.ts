import { Schema, model, Document, Types } from 'mongoose';

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due';
  limits: {
    projectsCount: number;
    storageBytes: number;
    aiQuestionsPerMonth: number;
  };
  renewAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    plan: {
      type: String,
      enum: ['free', 'pro', 'team', 'enterprise'],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due'],
      default: 'active',
    },
    limits: {
      projectsCount: { type: Number, default: 2 },
      storageBytes: { type: Number, default: 100 * 1024 * 1024 }, // 100MB
      aiQuestionsPerMonth: { type: Number, default: 20 },
    },
    renewAt: { type: Date },
  },
  { timestamps: true }
);

export const Subscription = model<ISubscription>('Subscription', SubscriptionSchema);
