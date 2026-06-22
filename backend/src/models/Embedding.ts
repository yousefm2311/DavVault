import { Schema, model, Document, Types } from 'mongoose';

export interface IEmbedding extends Document {
  userId: Types.ObjectId;
  projectId?: Types.ObjectId;
  sourceType: 'file' | 'codeEntity' | 'snippet' | 'errorSolution';
  sourceId: Types.ObjectId;
  content: string;
  vector: number[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const EmbeddingSchema = new Schema<IEmbedding>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    sourceType: {
      type: String,
      enum: ['file', 'codeEntity', 'snippet', 'errorSolution'],
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    content: { type: String, required: true },
    vector: { type: [Number], required: true }, // The numerical embedding array
    metadata: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Performance optimization index to retrieve user embeddings quickly
EmbeddingSchema.index({ userId: 1, projectId: 1, sourceType: 1 });

export const Embedding = model<IEmbedding>('Embedding', EmbeddingSchema);
