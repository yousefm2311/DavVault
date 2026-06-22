'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Info,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useNotifications, type Notification } from '@/context/NotificationContext';
import { useLanguage } from '@/context/LanguageContext';

const typeStyles: Record<Notification['type'], { icon: React.ReactNode; className: string }> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4 text-success" />,
    className: 'border-success/20 bg-success/10',
  },
  error: {
    icon: <XCircle className="h-4 w-4 text-danger" />,
    className: 'border-danger/20 bg-danger/10',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 text-warning" />,
    className: 'border-warning/20 bg-warning/10',
  },
  info: {
    icon: <Info className="h-4 w-4 text-accent-blue" />,
    className: 'border-accent-blue/20 bg-accent-blue/10',
  },
};

const formatTime = (value: string, language: 'ar' | 'en') => {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return language === 'ar' ? 'الآن' : 'Now';
  if (minutes < 60) return language === 'ar' ? `منذ ${minutes} دقيقة` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return language === 'ar' ? `منذ ${hours} ساعة` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return language === 'ar' ? `منذ ${days} يوم` : `${days}d ago`;
};

export const NotificationBell: React.FC = () => {
  const router = useRouter();
  const { t, dir, language } = useLanguage();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isRtl = dir === 'rtl';

  const updatePanelPosition = () => {
    if (!buttonRef.current || typeof window === 'undefined') return;

    const rect = buttonRef.current.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(360, window.innerWidth - margin * 2);
    const maxHeight = Math.min(430, window.innerHeight - margin * 2);

    let left = isRtl ? rect.right - width : rect.left;
    left = Math.min(Math.max(margin, left), window.innerWidth - width - margin);

    let top = rect.top - maxHeight - margin;
    if (top < margin) {
      top = rect.bottom + margin;
    }
    top = Math.min(Math.max(margin, top), window.innerHeight - maxHeight - margin);

    setPanelStyle({
      position: 'fixed',
      top,
      left,
      width,
      maxHeight,
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);

    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [isOpen, isRtl]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }

    if (notification.link) {
      setIsOpen(false);
      router.push(notification.link);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setIsOpen((value) => !value);
          if (!isOpen) fetchNotifications();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-card-border bg-white/5 text-text-secondary transition hover:border-accent-blue/40 hover:bg-white/10 hover:text-white"
        title={t('notifications')}
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow-lg shadow-danger/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 animate-ping rounded-full bg-danger/40" />
        )}
      </button>

      {mounted && isOpen && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="z-[100] overflow-hidden rounded-[24px] border border-card-border bg-card-bg/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
          dir={dir}
        >
          <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-white">{t('notifications')}</h3>
              <p className="text-[10px] text-text-secondary">
                {unreadCount > 0
                  ? language === 'ar'
                    ? `${unreadCount} غير مقروءة`
                    : `${unreadCount} unread`
                  : t('noNotifications')}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {loading && <Loader2 className="h-4 w-4 animate-spin text-accent-blue" />}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="rounded-lg p-1.5 text-text-secondary transition hover:bg-white/10 hover:text-white"
                  title={t('markAllRead')}
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto p-2">
            {notifications.length > 0 ? (
              notifications.map((notification) => {
                const style = typeStyles[notification.type];
                return (
                  <div
                    key={notification._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleNotificationClick(notification)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleNotificationClick(notification);
                    }}
                    className={`group mb-2 flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-right transition hover:bg-white/[0.08] ${style.className}`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-bg-primary/60">
                      {style.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="line-clamp-1 text-xs font-bold text-white">{notification.title}</h4>
                        {!notification.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-blue" />}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-text-secondary">
                        {notification.message}
                      </p>
                      <p className="mt-2 text-[9px] font-mono text-text-muted">
                        {formatTime(notification.createdAt, language)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteNotification(notification._id);
                      }}
                      className="rounded-lg p-1 text-text-muted opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                      title={t('deleteNotification')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-card-border bg-white/5">
                  <Bell className="h-5 w-5 text-accent-blue" />
                </div>
                <p className="text-xs font-semibold text-white">{t('noNotifications')}</p>
              </div>
            )}
          </div>
        </div>
        , document.body
      )}
    </div>
  );
};

export default NotificationBell;
