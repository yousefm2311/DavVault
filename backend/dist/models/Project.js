"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
const mongoose_1 = require("mongoose");
const ProjectSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true },
    description: { type: String },
    language: { type: String },
    framework: { type: String },
    database: { type: String },
    architectureType: { type: String },
    healthScore: { type: Number, default: 100 },
    uploadedAt: { type: Date, default: Date.now },
}, { timestamps: true });
exports.Project = (0, mongoose_1.model)('Project', ProjectSchema);
