import { Schema, model, Document, Types } from 'mongoose';

export interface ISnippet extends Document {
  userId: Types.ObjectId;
  title: string;
  code: string;
  language: string;
  explanation?: string;
  tags: string[];
  sourceProjectId?: Types.ObjectId;
  sourceFileId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SnippetSchema = new Schema<ISnippet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    code: { type: String, required: true },
    language: { type: String, required: true },
    explanation: { type: String },
    tags: [{ type: String }],
    sourceProjectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    sourceFileId: { type: Schema.Types.ObjectId, ref: 'File' },
  },
  { timestamps: true }
);

SnippetSchema.index({ userId: 1 });
SnippetSchema.index({ tags: 1 });

export const Snippet = model<ISnippet>('Snippet', SnippetSchema);
