"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeEntity = void 0;
const mongoose_1 = require("mongoose");
const CodeEntitySchema = new mongoose_1.Schema({
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', required: true },
    fileId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'File', required: true },
    type: {
        type: String,
        enum: ['function', 'class', 'route', 'model', 'service', 'controller'],
        required: true,
    },
    name: { type: String, required: true },
    code: { type: String, required: true },
    startLine: { type: Number, required: true },
    endLine: { type: Number, required: true },
    summary: { type: String },
    dependencies: [{ type: String }],
    tags: [{ type: String }],
}, { timestamps: true });
CodeEntitySchema.index({ projectId: 1, type: 1 });
CodeEntitySchema.index({ fileId: 1 });
exports.CodeEntity = (0, mongoose_1.model)('CodeEntity', CodeEntitySchema);
