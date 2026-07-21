import { Schema, model, Document, Types } from 'mongoose';

export interface ICitation {
  id?: string;
  type?: string;
  domainType?: string;
  title?: string;
  subtitle?: string;
  path?: string;
  relationshipType?: string;
  confidence?: number;
  source?: 'code' | 'search' | 'memory' | 'debugging_lesson' | 'architecture_blueprint' | 'knowledge_relationship';
  navigation?: {
    route?: string;
    projectId?: string;
    fileId?: string;
    entityId?: string;
  };
  fileName?: string;
  score?: number;
}

export interface IMessage {
  sender: 'user' | 'assistant';
  senderName?: string;
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
        senderName: { type: String },
        text: { type: String, required: true },
        citations: [
          {
            id: { type: String },
            type: { type: String },
            domainType: { type: String },
            title: { type: String },
            subtitle: { type: String },
            path: { type: String },
            relationshipType: { type: String },
            confidence: { type: Number },
            source: { type: String },
            navigation: {
              route: { type: String },
              projectId: { type: String },
              fileId: { type: String },
              entityId: { type: String },
            },
            fileName: { type: String },
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
