"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorSolution = void 0;
const mongoose_1 = require("mongoose");
const ErrorSolutionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    errorMessage: { type: String, required: true },
    cause: { type: String, required: true },
    solution: { type: String, required: true },
    beforeCode: { type: String },
    afterCode: { type: String },
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project' },
    tags: [{ type: String }],
    solvedAt: { type: Date, default: Date.now },
}, { timestamps: true });
ErrorSolutionSchema.index({ userId: 1 });
ErrorSolutionSchema.index({ tags: 1 });
exports.ErrorSolution = (0, mongoose_1.model)('ErrorSolution', ErrorSolutionSchema);
