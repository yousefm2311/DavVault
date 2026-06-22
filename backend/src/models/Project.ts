import { Schema, model, Document, Types } from 'mongoose';

export interface IProject extends Document {
  userId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  description?: string;
  language?: string;
  framework?: string;
  database?: string;
  architectureType?: string;
  healthScore: number;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true },
    description: { type: String },
    language: { type: String },
    framework: { type: String },
    database: { type: String },
    architectureType: { type: String },
    healthScore: { type: Number, default: 100 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Project = model<IProject>('Project', ProjectSchema);
