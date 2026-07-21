import { Schema, model, Document, Types } from 'mongoose';

// ─── Allowed entity node types ────────────────────────────────────────────────
export type KnowledgeNodeType =
  | 'codebase'
  | 'source_asset'
  | 'logical_entity'
  | 'code_asset'
  | 'debugging_lesson'
  | 'architecture_blueprint'
  | 'memory'
  | 'chat_session'
  | 'activity';

// ─── Allowed relationship types ───────────────────────────────────────────────
export type RelationshipType =
  | 'contains'
  | 'defines'
  | 'imports'
  | 'exports'
  | 'calls'
  | 'uses'
  | 'depends_on'
  | 'extends'
  | 'implements'
  | 'similar_to'
  | 'solves'
  | 'documents'
  | 'mentioned_in'
  | 'generated_from'
  | 'related_to';

// ─── Evidence sub-document ────────────────────────────────────────────────────
export interface IRelationshipEvidence {
  filePath?: string;
  sourceLine?: number;
  targetLine?: number;
  snippet?: string;
  reason?: string;
}

// ─── Main document interface ──────────────────────────────────────────────────
export interface IKnowledgeRelationship extends Document {
  userId: Types.ObjectId;
  workspaceId?: Types.ObjectId;
  projectId?: Types.ObjectId;
  sourceType: KnowledgeNodeType;
  sourceId: Types.ObjectId;
  targetType: KnowledgeNodeType;
  targetId: Types.ObjectId;
  relationshipType: RelationshipType;
  confidence: number;
  evidence?: IRelationshipEvidence;
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NODE_TYPES: KnowledgeNodeType[] = [
  'codebase',
  'source_asset',
  'logical_entity',
  'code_asset',
  'debugging_lesson',
  'architecture_blueprint',
  'memory',
  'chat_session',
  'activity',
];

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'contains',
  'defines',
  'imports',
  'exports',
  'calls',
  'uses',
  'depends_on',
  'extends',
  'implements',
  'similar_to',
  'solves',
  'documents',
  'mentioned_in',
  'generated_from',
  'related_to',
];

const KnowledgeRelationshipSchema = new Schema<IKnowledgeRelationship>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User',      required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' },
    projectId:   { type: Schema.Types.ObjectId, ref: 'Project' },
    sourceType: { type: String, enum: NODE_TYPES,         required: true },
    sourceId:   { type: Schema.Types.ObjectId,            required: true },
    targetType: { type: String, enum: NODE_TYPES,         required: true },
    targetId:   { type: Schema.Types.ObjectId,            required: true },
    relationshipType: { type: String, enum: RELATIONSHIP_TYPES, required: true },
    confidence: { type: Number, default: 0.7, min: 0, max: 1 },
    evidence: {
      filePath:   { type: String },
      sourceLine: { type: Number },
      targetLine: { type: Number },
      snippet:    { type: String, maxlength: 500 },
      reason:     { type: String, maxlength: 500 },
    },
    metadata: { type: Schema.Types.Mixed },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Outgoing lookup
KnowledgeRelationshipSchema.index({ userId: 1, sourceType: 1, sourceId: 1 });
// Incoming lookup
KnowledgeRelationshipSchema.index({ userId: 1, targetType: 1, targetId: 1 });
// Project-scoped traversal
KnowledgeRelationshipSchema.index({ projectId: 1, relationshipType: 1 });
// Cross-type traversal
KnowledgeRelationshipSchema.index({ sourceType: 1, targetType: 1, relationshipType: 1 });
// Active filter
KnowledgeRelationshipSchema.index({ isActive: 1 });

// ─── Compound unique index (deduplication) ────────────────────────────────────
// Prevents duplicate edges: same source + target + relationship = one document.
KnowledgeRelationshipSchema.index(
  {
    userId:           1,
    sourceType:       1,
    sourceId:         1,
    targetType:       1,
    targetId:         1,
    relationshipType: 1,
  },
  { unique: true, sparse: false }
);

export const KnowledgeRelationship = model<IKnowledgeRelationship>(
  'KnowledgeRelationship',
  KnowledgeRelationshipSchema
);
