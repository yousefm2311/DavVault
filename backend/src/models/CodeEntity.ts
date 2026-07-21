import { Schema, model, Document, Types } from 'mongoose';

export interface ICodeEntity extends Document {
  projectId: Types.ObjectId;
  fileId: Types.ObjectId;
  type: 'function' | 'class' | 'route' | 'model' | 'service' | 'controller';
  name: string;
  code: string;
  startLine: number;
  endLine: number;
  summary?: string;
  dependencies: string[];
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CodeEntitySchema = new Schema<ICodeEntity>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    fileId: { type: Schema.Types.ObjectId, ref: 'File', required: true },
    type: {
      type: String,
      enum: ['function', 'class', 'route', 'model', 'service', 'controller'],
      required: true,
    },
    name: { type: String, required: true },
    code: { type: String, required: true },
    startLine: { type: Number, required: true },
    endLine: { type: Number, required: true },
    summary: { type: String },
    dependencies: [{ type: String }],
    tags: [{ type: String }],
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

CodeEntitySchema.index({ projectId: 1, type: 1 });
CodeEntitySchema.index({ fileId: 1 });

export const CodeEntity = model<ICodeEntity>('CodeEntity', CodeEntitySchema);
