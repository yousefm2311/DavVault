"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.File = void 0;
const mongoose_1 = require("mongoose");
const FileSchema = new mongoose_1.Schema({
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    path: { type: String, required: true },
    fileName: { type: String, required: true },
    extension: { type: String, required: true },
    size: { type: Number, required: true },
    content: { type: String, required: true },
    summary: { type: String },
    language: { type: String },
}, { timestamps: true });
// Search optimization indices
FileSchema.index({ projectId: 1, path: 1 });
FileSchema.index({ userId: 1 });
exports.File = (0, mongoose_1.model)('File', FileSchema);
