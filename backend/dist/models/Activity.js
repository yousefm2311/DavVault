"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Activity = void 0;
const mongoose_1 = require("mongoose");
const ActivitySchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entityType: {
        type: String,
        enum: ['project', 'file', 'snippet', 'error', 'system', 'auth'],
        required: true,
    },
    entityId: { type: mongoose_1.Schema.Types.ObjectId },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: { createdAt: true, updatedAt: false } });
ActivitySchema.index({ userId: 1, createdAt: -1 });
exports.Activity = (0, mongoose_1.model)('Activity', ActivitySchema);
