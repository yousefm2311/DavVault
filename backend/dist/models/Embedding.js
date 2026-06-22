"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Embedding = void 0;
const mongoose_1 = require("mongoose");
const EmbeddingSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project' },
    sourceType: {
        type: String,
        enum: ['file', 'codeEntity', 'snippet', 'errorSolution'],
        required: true,
    },
    sourceId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    content: { type: String, required: true },
    vector: { type: [Number], required: true }, // The numerical embedding array
    metadata: { type: Map, of: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
// Performance optimization index to retrieve user embeddings quickly
EmbeddingSchema.index({ userId: 1, projectId: 1, sourceType: 1 });
exports.Embedding = (0, mongoose_1.model)('Embedding', EmbeddingSchema);
