import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Notification } from '../models/Notification';
import { findAccessibleProject, isValidObjectIdString } from '../utils/access-control';

const invalidIdResponse = (res: Response, field: string) => res.status(400).json({
  error: `Invalid ${field}.`,
  code: 'INVALID_OBJECT_ID',
});

const notFoundResponse = (res: Response) => res.status(404).json({
  error: 'Notification not found.',
  code: 'NOTIFICATION_NOT_FOUND',
});

const serverErrorResponse = (res: Response, code: string) => res.status(500).json({
  error: 'An unexpected notification API error occurred.',
  code,
});

const normalizeLimit = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(1, Math.floor(parsed)));
};

const safeInternalLink = (value?: string) => {
  if (!value || typeof value !== 'string') return undefined;
  if (!value.startsWith('/') || value.startsWith('//') || /\s/.test(value)) return undefined;
  const allowedPrefixes = ['/projects', '/snippets', '/errors', '/systems', '/billing', '/profile', '/dashboard', '/chat'];
  return allowedPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`))
    ? value
    : undefined;
};

const projectIdFromLink = (link?: string) => {
  const match = link?.match(/^\/projects\/([a-fA-F0-9]{24})(?:$|[/?#])/);
  return match?.[1];
};

const normalizeNotification = async (notification: any, userId: string) => {
  let link = safeInternalLink(notification.link);
  const projectId = projectIdFromLink(link);
  if (projectId) {
    const project = await findAccessibleProject(userId, projectId, '_id');
    if (!project) link = undefined;
  }

  return {
    _id: notification._id?.toString(),
    userId: notification.userId?.toString(),
    title: notification.title || 'Notification',
    message: notification.message || '',
    type: notification.type || 'info',
    isRead: Boolean(notification.isRead),
    link,
    createdAt: notification.createdAt instanceof Date
      ? notification.createdAt.toISOString()
      : new Date(notification.createdAt || Date.now()).toISOString(),
    updatedAt: notification.updatedAt instanceof Date
      ? notification.updatedAt.toISOString()
      : new Date(notification.updatedAt || notification.createdAt || Date.now()).toISOString(),
  };
};

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const limit = normalizeLimit(req.query.limit);
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    const normalizedNotifications = await Promise.all(
      notifications.map((notification) => normalizeNotification(notification, req.user!.id))
    );

    return res.status(200).json({ notifications: normalizedNotifications, unreadCount });
  } catch {
    return serverErrorResponse(res, 'NOTIFICATION_LIST_FAILED');
  }
};

export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const unreadCount = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    return res.status(200).json({ unreadCount });
  } catch {
    return serverErrorResponse(res, 'NOTIFICATION_COUNT_FAILED');
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const { id } = req.params;
    if (!isValidObjectIdString(id)) return invalidIdResponse(res, 'notificationId');

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { isRead: true },
      { new: true }
    ).lean();

    if (!notification) {
      return notFoundResponse(res);
    }

    return res.status(200).json({
      message: 'Marked as read',
      notification: await normalizeNotification(notification, req.user.id),
    });
  } catch {
    return serverErrorResponse(res, 'NOTIFICATION_MARK_READ_FAILED');
  }
};

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });

    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch {
    return serverErrorResponse(res, 'NOTIFICATION_MARK_ALL_READ_FAILED');
  }
};

export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const { id } = req.params;
    if (!isValidObjectIdString(id)) return invalidIdResponse(res, 'notificationId');

    const result = await Notification.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!result) {
      return notFoundResponse(res);
    }

    return res.status(200).json({ message: 'Notification deleted' });
  } catch {
    return serverErrorResponse(res, 'NOTIFICATION_DELETE_FAILED');
  }
};
