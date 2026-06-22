"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subscription = void 0;
const mongoose_1 = require("mongoose");
const SubscriptionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    plan: {
        type: String,
        enum: ['free', 'pro', 'team', 'enterprise'],
        default: 'free',
    },
    status: {
        type: String,
        enum: ['active', 'canceled', 'past_due'],
        default: 'active',
    },
    limits: {
        projectsCount: { type: Number, default: 2 },
        storageBytes: { type: Number, default: 100 * 1024 * 1024 }, // 100MB
        aiQuestionsPerMonth: { type: Number, default: 20 },
    },
    renewAt: { type: Date },
}, { timestamps: true });
exports.Subscription = (0, mongoose_1.model)('Subscription', SubscriptionSchema);
