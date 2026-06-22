import { Schema, model, Document, Types } from 'mongoose';

export interface ICitation {
  fileName: string;
  path: string;
  code?: string;
  score?: number;
}

export interface IMessage {
  sender: 'user' | 'assistant';
  text: string;
  citations?: ICitation[];
  createdAt: Date;
}

export interface IChatSession extends Document {
  userId: Types.ObjectId;
  projectId?: Types.ObjectId;
  title: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatSessionSchema = new Schema<IChatSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    title: { type: String, required: true },
    messages: [
      {
        sender: { type: String, enum: ['user', 'assistant'], required: true },
        text: { type: String, required: true },
        citations: [
          {
            fileName: { type: String, required: true },
            path: { type: String, required: true },
            code: { type: String },
            score: { type: Number },
          },
        ],
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

ChatSessionSchema.index({ userId: 1 });

export const ChatSession = model<IChatSession>('ChatSession', ChatSessionSchema);
