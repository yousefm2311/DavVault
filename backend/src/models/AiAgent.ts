import { Schema, model, Document, Types } from 'mongoose';

export interface IAiAgent extends Document {
  userId?: Types.ObjectId; // Owner of the custom agent, undefined/null for system-defined bots
  name: string;
  email: string;
  role: string;
  focus: string;
  systemPrompt: string;
  modelProvider: 'gemini' | 'openai';
  modelName: string;
  apiKey?: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AiAgentSchema = new Schema<IAiAgent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, required: true },
    focus: { type: String, required: true },
    systemPrompt: { type: String, required: true },
    modelProvider: { type: String, enum: ['gemini', 'openai'], default: 'gemini' },
    modelName: { type: String, default: 'gemini-1.5-flash' },
    apiKey: { type: String, select: false },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index to quickly fetch custom agents for a user or system default agents
AiAgentSchema.index({ userId: 1, isSystem: 1 });

export const AiAgent = model<IAiAgent>('AiAgent', AiAgentSchema);
