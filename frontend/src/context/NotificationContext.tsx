'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export interface Notification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  actionError: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  pushLocalNotification: (notification: Omit<Notification, '_id' | 'userId' | 'createdAt' | 'isRead'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const isValidObjectIdString = (value?: string) => (
  typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value)
);

const normalizeNotification = (notification: any): Notification | null => {
  const id = typeof notification?._id === 'string' ? notification._id : '';
  if (!id) return null;

  const createdAt = new Date(notification.createdAt || Date.now());
  return {
    _id: id,
    userId: typeof notification.userId === 'string' ? notification.userId : '',
    title: String(notification.title || 'Notification'),
    message: String(notification.message || ''),
    type: ['info', 'success', 'warning', 'error'].includes(notification.type) ? notification.type : 'info',
    isRead: Boolean(notification.isRead),
    link: typeof notification.link === 'string' ? notification.link : undefined,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString(),
  };
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, apiFetch } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setError(null);
      const data = await apiFetch('/notifications');
      if (data && Array.isArray(data.notifications)) {
        setNotifications(data.notifications.map(normalizeNotification).filter(Boolean) as Notification[]);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError(error instanceof Error ? error.message : 'Unable to load notifications.');
      setUnreadCount(0);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      setActionError(null);
      if (!id.startsWith('local-') && !isValidObjectIdString(id)) {
        setActionError('Unable to update notification.');
        return;
      }
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      if (id.startsWith('local-')) return;
      await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setActionError(error instanceof Error ? error.message : 'Unable to update notification.');
      // Rollback
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    try {
      setActionError(null);
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);

      await apiFetch('/notifications/mark-all-read', { method: 'PUT' });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      setActionError(error instanceof Error ? error.message : 'Unable to update notifications.');
      // Rollback
      fetchNotifications();
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      setActionError(null);
      if (!id.startsWith('local-') && !isValidObjectIdString(id)) {
        setActionError('Unable to delete notification.');
        return;
      }
      const target = notifications.find((n) => n._id === id);
      const isUnread = target ? !target.isRead : false;
      
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (isUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      if (id.startsWith('local-')) return;
      await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Error deleting notification:', error);
      setActionError(error instanceof Error ? error.message : 'Unable to delete notification.');
      // Rollback
      fetchNotifications();
    }
  };

  // Push a temporary local notification directly into state for instant UI feedback
  const pushLocalNotification = (notif: Omit<Notification, '_id' | 'userId' | 'createdAt' | 'isRead'>) => {
    const localNotif: Notification = {
      _id: `local-${Date.now()}`,
      userId: user?.id || 'local',
      title: notif.title,
      message: notif.message,
      type: notif.type,
      isRead: false,
      link: notif.link,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [localNotif, ...prev]);
    setUnreadCount((prev) => prev + 1);
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setError(null);
      setActionError(null);
      return;
    }

    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));

    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        actionError,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        pushLocalNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
