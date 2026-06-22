"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Snippet = void 0;
const mongoose_1 = require("mongoose");
const SnippetSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    code: { type: String, required: true },
    language: { type: String, required: true },
    explanation: { type: String },
    tags: [{ type: String }],
    sourceProjectId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project' },
    sourceFileId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'File' },
}, { timestamps: true });
SnippetSchema.index({ userId: 1 });
SnippetSchema.index({ tags: 1 });
exports.Snippet = (0, mongoose_1.model)('Snippet', SnippetSchema);
