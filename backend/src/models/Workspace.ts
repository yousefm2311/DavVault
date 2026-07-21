import { Schema, model, Document, Types } from 'mongoose';

export interface IWorkspaceMember {
  userId: Types.ObjectId;
  role: 'owner' | 'admin' | 'member';
}

export interface IWorkspace extends Document {
  name: string;
  ownerId: Types.ObjectId;
  members: IWorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
      },
    ],
  },
  { timestamps: true }
);

WorkspaceSchema.index({ ownerId: 1 });
WorkspaceSchema.index({ 'members.userId': 1 });

WorkspaceSchema.pre('validate', function dedupeMembers(next) {
  const seen = new Set<string>();
  const members: IWorkspaceMember[] = [];

  for (const member of this.members || []) {
    const memberId = member.userId?.toString();
    if (!memberId || seen.has(memberId)) continue;
    seen.add(memberId);
    members.push(member);
  }

  const ownerId = this.ownerId?.toString();
  if (ownerId && !seen.has(ownerId)) {
    members.unshift({ userId: this.ownerId, role: 'owner' });
  }

  this.members = members;
  next();
});

export const Workspace = model<IWorkspace>('Workspace', WorkspaceSchema);
