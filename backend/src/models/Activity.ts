import { Schema, model, Document, Types } from 'mongoose';

export interface IActivity extends Document {
  userId: Types.ObjectId;
  action: string;
  entityType: 'project' | 'file' | 'snippet' | 'error' | 'system' | 'auth';
  entityId?: Types.ObjectId;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entityType: {
      type: String,
      enum: ['project', 'file', 'snippet', 'error', 'system', 'auth'],
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivitySchema.index({ userId: 1, createdAt: -1 });

export const Activity = model<IActivity>('Activity', ActivitySchema);
