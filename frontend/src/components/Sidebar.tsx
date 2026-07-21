'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCommand } from '@/context/CommandContext';
import { useLanguage } from '@/context/LanguageContext';
import { NotificationBell } from '@/components/NotificationBell';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FolderCode,
  Command,
  MessageSquareCode,
  Search,
  Code2,
  Bug,
  Brain,
  LogOut,
  Zap,
  Users,
  Boxes,
  History,
  CreditCard,
  Settings,
  Globe,
  ShieldCheck
} from 'lucide-react';

interface SidebarItem {
  nameKey: string;
  mobileNameKey: string;
  path: string;
  icon: LucideIcon;
}

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user, logout, apiFetch } = useAuth();
  const { toggleSearch } = useCommand();
  const { t, dir, language, toggleLanguage } = useLanguage();
  const [storagePercent, setStoragePercent] = useState(0);
  const [effectivePlan, setEffectivePlan] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void apiFetch('/subscription')
      .then((data) => {
        const used = Number(data.usage?.storageBytes || 0);
        const limit = Number(data.limits?.storageBytes || 0);
        setStoragePercent(limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0);
        if (typeof data.plan === 'string') setEffectivePlan(data.plan);
      })
      .catch(() => {
        setStoragePercent(0);
        setEffectivePlan(null);
      });
  }, [user]);

  const menuItems: SidebarItem[] = [
    { nameKey: 'dashboard', mobileNameKey: 'dashboard', path: '/dashboard', icon: LayoutDashboard },
    { nameKey: 'projects', mobileNameKey: 'projects', path: '/projects', icon: FolderCode },
    { nameKey: 'aiChat', mobileNameKey: 'aiChat', path: '/chat', icon: MessageSquareCode },
    { nameKey: 'snippets', mobileNameKey: 'snippets', path: '/snippets', icon: Code2 },
    { nameKey: 'errors', mobileNameKey: 'errors', path: '/errors', icon: Bug },
    { nameKey: 'systems', mobileNameKey: 'systems', path: '/systems', icon: Boxes },
    { nameKey: 'developerDna', mobileNameKey: 'developerDna', path: '/developer-dna', icon: Brain },
    { nameKey: 'timeMachine', mobileNameKey: 'timeMachine', path: '/time-machine', icon: History },
    { nameKey: 'team', mobileNameKey: 'team', path: '/team', icon: Users },
    { nameKey: 'billing', mobileNameKey: 'billing', path: '/billing', icon: CreditCard },
  ];

  if (user?.role === 'admin' || user?.role === 'superadmin') {
    menuItems.push({ nameKey: 'adminPanel', mobileNameKey: 'adminPanel', path: '/admin', icon: ShieldCheck });
  }

  const bottomItems = menuItems.slice(0, 5);
  const isActivePath = (path: string) =>
    pathname === path || (path !== '/dashboard' && pathname.startsWith(path));

  const isRtl = dir === 'rtl';

  return (
    <>
    <aside className={`hidden lg:flex w-72 bg-bg-secondary ${isRtl ? 'border-l' : 'border-r'} border-card-border flex-col h-screen sticky top-0 p-5 select-none overflow-y-auto`}>
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-7">
        <div className="w-10 h-10 rounded-xl bg-accent-blue/90 flex items-center justify-center shadow-lg shadow-accent-blue/20 ring-1 ring-white/10">
          <Command className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-[21px] leading-none tracking-tight text-white">DevVault AI</h1>
          <p className="text-[10px] text-text-muted tracking-[0.22em] uppercase font-bold mt-1.5">
            {t('intelligentDeveloperMemory')}
          </p>
        </div>
      </div>

      {/* Global Cmd+K trigger button */}
      <button
        onClick={toggleSearch}
        className="w-full flex items-center justify-between px-4 py-3 mb-6 bg-card-bg/45 border border-card-border rounded-2xl text-xs text-text-secondary hover:bg-card-bg/75 hover:text-white transition-all duration-200 outline-none"
      >
        <span className="flex items-center gap-2">
          <Search className="w-4 h-4 opacity-70" />
          {t('searchMemory')}
        </span>
        <span className="bg-bg-primary border border-card-border px-1.5 py-0.5 rounded-md text-[10px] font-mono text-text-secondary">
          ⌘K
        </span>
      </button>

      {/* Main Navigation menu */}
      <nav className="flex-1 space-y-1 pr-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActivePath(item.path);
          return (
            <Link key={item.nameKey} href={item.path}>
              <span
                className={`relative flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer mb-1 ${
                  isActive
                    ? 'bg-white/10 text-white shadow-lg shadow-black/20 before:absolute before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-accent-blue ' +
                      (isRtl ? 'before:right-0' : 'before:left-0')
                    : 'text-text-muted hover:bg-card-bg/60 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isRtl ? 'ml-3' : 'mr-3'}`} />
                {t(item.nameKey)}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile & Logout */}
      <div className="border-t border-card-border pt-4 mt-auto flex flex-col space-y-4">
        <button
          onClick={() => window.location.href = '/projects?action=upload'}
          className="w-full rounded-2xl bg-[#9DBDFF] px-4 py-4 text-right ltr:text-left text-[#071A3A] shadow-lg shadow-accent-blue/10 transition hover:brightness-105"
        >
          <span className="text-[10px] uppercase tracking-[0.24em]">Vault Plus</span>
          <span className="mt-1 block text-sm font-bold">{t('newProject')}</span>
        </button>
        <div className="space-y-2 px-1">
          <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            <span>{t('cloudStorage')}</span>
            <span>{storagePercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#9DBDFF]" style={{ width: `${storagePercent}%` }} />
          </div>
        </div>
        {user && (
          <div className="flex flex-col gap-3 rounded-2xl border border-card-border bg-card-bg/50 p-3">
            <div className="flex items-center justify-between">
              <Link href="/profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 min-w-0">
                <img
                  src={user.avatar || 'https://lh3.googleusercontent.com/a/default-user'}
                  alt={user.name}
                  className="w-10 h-10 rounded-full border border-card-border object-cover"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate block">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-text-secondary font-mono tracking-wider flex items-center">
                    <span className={`w-1.5 h-1.5 rounded-full bg-success ${isRtl ? 'ml-1' : 'mr-1'}`}></span>
                    {(effectivePlan || user.plan).toUpperCase()}
                  </span>
                </div>
              </Link>
            </div>
            
            <div className="flex items-center justify-between border-t border-card-border/60 pt-2.5 px-1">
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 rounded-lg text-text-secondary hover:text-white transition-colors text-[10px] font-bold font-mono"
                title={t('switchLanguageTitle')}
              >
                <Globe className="w-3.5 h-3.5 text-accent-blue" />
                {language === 'ar' ? 'EN' : 'العربية'}
              </button>
              
              <div className="flex items-center gap-1">
                <NotificationBell />
                <Link href="/profile" className="p-1.5 hover:bg-white/5 rounded-lg text-text-secondary hover:text-white transition-colors" title={t('profileSettings')}>
                  <Settings className="w-4 h-4" />
                </Link>
                <button
                  onClick={logout}
                  className="p-1.5 hover:bg-white/5 hover:text-danger rounded-lg text-text-secondary transition-colors"
                  title={t('logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>

    <button
      onClick={toggleSearch}
      title={t('searchMemory')}
      className={`lg:hidden fixed bottom-[92px] ${isRtl ? 'right-6' : 'left-6'} z-40 flex h-16 w-16 items-center justify-center rounded-full bg-accent-blue text-white shadow-2xl shadow-accent-blue/30`}
    >
      <Search className="w-7 h-7" />
    </button>

    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-card-border bg-bg-secondary/95 px-5 pb-4 pt-3 backdrop-blur-xl">
      <div className="grid grid-cols-5 items-center gap-1">
        {bottomItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = isActivePath(item.path);
          return (
            <Link key={item.nameKey} href={item.path} title={t(item.nameKey)}>
              <span
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-all ${
                  isActive
                    ? 'text-white'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{t(item.mobileNameKey)}</span>
                <span className={`h-1 w-1 rounded-full ${isActive ? 'bg-[#9DBDFF]' : 'bg-transparent'}`} />
              </span>
            </Link>
          );
        })}
        <Link href="/systems" title={t('systems')}>
          <span className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-all ${isActivePath('/systems') ? 'text-white' : 'text-text-muted hover:text-white'}`}>
            <Boxes className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{t('systems')}</span>
            <span className={`h-1 w-1 rounded-full ${isActivePath('/systems') ? 'bg-[#9DBDFF]' : 'bg-transparent'}`} />
          </span>
        </Link>
      </div>
    </nav>
    </>
  );
};
export default Sidebar;
