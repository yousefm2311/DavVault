import { Schema, model, Document, Types } from 'mongoose';

export interface IFile extends Document {
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  path: string;
  fileName: string;
  extension: string;
  size: number;
  content: string;
  summary?: string;
  language?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    path: { type: String, required: true },
    fileName: { type: String, required: true },
    extension: { type: String, required: true },
    size: { type: Number, required: true },
    content: { type: String, required: true },
    summary: { type: String },
    language: { type: String },
  },
  { timestamps: true }
);

// Search optimization indices
FileSchema.index({ projectId: 1, path: 1 });
FileSchema.index({ userId: 1 });

export const File = model<IFile>('File', FileSchema);
