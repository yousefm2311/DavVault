import { Schema, model, Document, Types } from 'mongoose';

export interface IErrorSolution extends Document {
  userId: Types.ObjectId;
  title: string;
  errorMessage: string;
  cause: string;
  solution: string;
  beforeCode?: string;
  afterCode?: string;
  projectId?: Types.ObjectId;
  tags: string[];
  solvedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ErrorSolutionSchema = new Schema<IErrorSolution>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    errorMessage: { type: String, required: true },
    cause: { type: String, required: true },
    solution: { type: String, required: true },
    beforeCode: { type: String },
    afterCode: { type: String },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    tags: [{ type: String }],
    solvedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ErrorSolutionSchema.index({ userId: 1 });
ErrorSolutionSchema.index({ tags: 1 });

export const ErrorSolution = model<IErrorSolution>('ErrorSolution', ErrorSolutionSchema);
