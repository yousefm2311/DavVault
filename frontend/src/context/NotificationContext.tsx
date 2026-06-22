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
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  pushLocalNotification: (notification: Omit<Notification, '_id' | 'userId' | 'createdAt' | 'isRead'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, apiFetch } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await apiFetch('/notifications');
      if (data && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      if (id.startsWith('local-')) return;
      await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Rollback
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    try {
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);

      await apiFetch('/notifications/mark-all-read', { method: 'PUT' });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      // Rollback
      fetchNotifications();
    }
  };

  const deleteNotification = async (id: string) => {
    try {
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
