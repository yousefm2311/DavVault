"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Workspace = void 0;
const mongoose_1 = require("mongoose");
const WorkspaceSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
        {
            userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
            role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
        },
    ],
}, { timestamps: true });
exports.Workspace = (0, mongoose_1.model)('Workspace', WorkspaceSchema);
