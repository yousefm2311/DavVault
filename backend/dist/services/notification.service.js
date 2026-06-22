"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const models_1 = require("../models");
exports.notificationService = {
    async create({ userId, title, message, type = 'info', link, }) {
        return models_1.Notification.create({
            userId,
            title,
            message,
            type,
            link,
        });
    },
};
