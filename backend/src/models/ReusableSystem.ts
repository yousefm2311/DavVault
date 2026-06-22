import { Schema, model, Document, Types } from 'mongoose';

export interface IReusableSystem extends Document {
  userId: Types.ObjectId;
  name: string;
  description: string;
  type: string;
  relatedFiles: string[];
  setupSteps: string[];
  dependencies: string[];
  flow?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ReusableSystemSchema = new Schema<IReusableSystem>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, required: true },
    relatedFiles: [{ type: String }],
    setupSteps: [{ type: String }],
    dependencies: [{ type: String }],
    flow: { type: String },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

ReusableSystemSchema.index({ userId: 1 });

export const ReusableSystem = model<IReusableSystem>('ReusableSystem', ReusableSystemSchema);
