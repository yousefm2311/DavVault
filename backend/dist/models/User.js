"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    avatar: { type: String },
    bio: { type: String },
    plan: { type: String, enum: ['free', 'pro', 'team', 'enterprise'], default: 'free' },
    role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user', index: true },
    status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'active', index: true },
    googleId: { type: String },
    githubId: { type: String },
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String },
    verificationCodeExpires: { type: Date },
}, { timestamps: true });
exports.User = (0, mongoose_1.model)('User', UserSchema);
