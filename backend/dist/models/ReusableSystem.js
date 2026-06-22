"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReusableSystem = void 0;
const mongoose_1 = require("mongoose");
const ReusableSystemSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, required: true },
    relatedFiles: [{ type: String }],
    setupSteps: [{ type: String }],
    dependencies: [{ type: String }],
    flow: { type: String },
    tags: [{ type: String }],
}, { timestamps: true });
ReusableSystemSchema.index({ userId: 1 });
exports.ReusableSystem = (0, mongoose_1.model)('ReusableSystem', ReusableSystemSchema);
