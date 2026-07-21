import { Types } from 'mongoose';
import { Notification } from '../models';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

type CreateNotificationInput = {
  userId: string | Types.ObjectId;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
};

export const notificationService = {
  async create({
    userId,
    title,
    message,
    type = 'info',
    link,
  }: CreateNotificationInput) {
    if (!Types.ObjectId.isValid(userId)) {
      console.warn('[NotificationService]: Ignoring notification for invalid user id.');
      return null;
    }

    const safeLink = typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') && !/\s/.test(link)
      ? link
      : undefined;

    return Notification.create({
      userId,
      title: String(title || 'Notification').slice(0, 160),
      message: String(message || '').slice(0, 1000),
      type,
      link: safeLink,
    });
  },
};
