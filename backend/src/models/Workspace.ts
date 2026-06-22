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

export const Workspace = model<IWorkspace>('Workspace', WorkspaceSchema);
