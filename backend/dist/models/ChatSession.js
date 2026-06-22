"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSession = void 0;
const mongoose_1 = require("mongoose");
const ChatSessionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project' },
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
}, { timestamps: true });
ChatSessionSchema.index({ userId: 1 });
exports.ChatSession = (0, mongoose_1.model)('ChatSession', ChatSessionSchema);
