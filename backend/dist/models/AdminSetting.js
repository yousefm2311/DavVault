"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSetting = void 0;
const mongoose_1 = require("mongoose");
const AdminSettingSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
exports.AdminSetting = (0, mongoose_1.model)('AdminSetting', AdminSettingSchema);
