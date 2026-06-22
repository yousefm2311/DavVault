"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.getNotifications = void 0;
const Notification_1 = require("../models/Notification");
const getNotifications = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const limit = Number(req.query.limit) || 50;
        const notifications = await Notification_1.Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(limit);
        const unreadCount = await Notification_1.Notification.countDocuments({ userId: req.user.id, isRead: false });
        return res.status(200).json({ notifications, unreadCount });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getNotifications = getNotifications;
const markAsRead = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id } = req.params;
        const notification = await Notification_1.Notification.findOneAndUpdate({ _id: id, userId: req.user.id }, { isRead: true }, { new: true });
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        return res.status(200).json({ message: 'Marked as read', notification });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        await Notification_1.Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
        return res.status(200).json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.markAllAsRead = markAllAsRead;
const deleteNotification = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id } = req.params;
        const result = await Notification_1.Notification.findOneAndDelete({ _id: id, userId: req.user.id });
        if (!result) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        return res.status(200).json({ message: 'Notification deleted' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.deleteNotification = deleteNotification;
