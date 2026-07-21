import { Schema, model, Document, Types } from 'mongoose';

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
  limits: {
    projectsCount: number;
    storageBytes: number;
    aiQuestionsPerMonth: number;
    teamMembers?: number;
  };
  renewAt?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeProcessedEventIds?: string[];
  stripeUpdatedAt?: Date;
  isLocalSimulation?: boolean;
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
      enum: ['active', 'canceled', 'past_due', 'incomplete', 'trialing'],
      default: 'active',
    },
    limits: {
      projectsCount: { type: Number, default: 2 },
      storageBytes: { type: Number, default: 100 * 1024 * 1024 }, // 100MB
      aiQuestionsPerMonth: { type: Number, default: 20 },
      teamMembers: { type: Number, default: 1 },
    },
    renewAt: { type: Date },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    stripeProcessedEventIds: [{ type: String }],
    stripeUpdatedAt: { type: Date },
    isLocalSimulation: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Subscription = model<ISubscription>('Subscription', SubscriptionSchema);
