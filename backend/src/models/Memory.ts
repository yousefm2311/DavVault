import { Schema, model, Document, Types } from 'mongoose';

export type MemoryType =
  | 'preference'
  | 'coding_style'
  | 'architecture_rule'
  | 'debugging_pattern'
  | 'tooling_preference'
  | 'workspace_rule'
  | 'correction'
  | 'decision';

export type MemoryScope = 'user' | 'project' | 'workspace';

export type MemorySource =
  | 'chat'
  | 'manual'
  | 'system'
  | 'developer_dna'
  | 'debugging_lesson';

export interface IMemory extends Document {
  userId: Types.ObjectId;
  workspaceId?: Types.ObjectId;
  projectId?: Types.ObjectId;
  type: MemoryType;
  scope: MemoryScope;
  title: string;
  content: string;
  source: MemorySource;
  confidence: number;
  usageCount: number;
  lastUsedAt?: Date;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MemorySchema = new Schema<IMemory>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User',      required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' },
    projectId:   { type: Schema.Types.ObjectId, ref: 'Project' },
    type: {
      type: String,
      enum: [
        'preference',
        'coding_style',
        'architecture_rule',
        'debugging_pattern',
        'tooling_preference',
        'workspace_rule',
        'correction',
        'decision',
      ],
      required: true,
    },
    scope: {
      type: String,
      enum: ['user', 'project', 'workspace'],
      required: true,
    },
    title:      { type: String, required: true, maxlength: 200 },
    content:    { type: String, required: true, maxlength: 2000 },
    source: {
      type: String,
      enum: ['chat', 'manual', 'system', 'developer_dna', 'debugging_lesson'],
      required: true,
    },
    confidence:  { type: Number, default: 0.7, min: 0, max: 1 },
    usageCount:  { type: Number, default: 0 },
    lastUsedAt:  { type: Date },
    tags:        [{ type: String }],
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes
MemorySchema.index({ userId: 1, scope: 1, type: 1 });
MemorySchema.index({ workspaceId: 1, scope: 1, type: 1 });
MemorySchema.index({ projectId: 1, scope: 1, type: 1 });
MemorySchema.index({ isActive: 1 });
MemorySchema.index({ updatedAt: -1 });

export const Memory = model<IMemory>('Memory', MemorySchema);
