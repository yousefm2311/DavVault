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
    return Notification.create({
      userId,
      title,
      message,
      type,
      link,
    });
  },
};
