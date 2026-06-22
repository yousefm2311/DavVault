'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCommand } from '@/context/CommandContext';
import {
  LayoutDashboard,
  FolderCode,
  MessageSquareCode,
  Search,
  Code2,
  Bug,
  Brain,
  Sliders,
  LogOut,
  Zap,
  Activity,
  Users,
  Boxes,
  History
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { toggleSearch } = useCommand();

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', path: '/projects', icon: FolderCode },
    { name: 'AI Chat', path: '/chat', icon: MessageSquareCode },
    { name: 'Snippets Library', path: '/snippets', icon: Code2 },
    { name: 'Error Library', path: '/errors', icon: Bug },
    { name: 'Reusable Systems', path: '/systems', icon: Boxes },
    { name: 'Developer DNA', path: '/developer-dna', icon: Brain },
    { name: 'Time Machine', path: '/time-machine', icon: History },
    { name: 'Team Brain', path: '/team', icon: Users },
  ];

  const subMenuItems: any[] = [];

  return (
    <aside className="w-72 bg-bg-secondary border-r border-card-border flex flex-col h-screen sticky top-0 p-6 select-none">
      {/* Brand Header */}
      <div className="flex items-center space-x-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-accent-blue flex items-center justify-center shadow-lg shadow-accent-blue/20">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight text-white">DevVault AI</h1>
          <p className="text-[10px] text-text-secondary tracking-wider uppercase font-medium">
            Engineering Memory
          </p>
        </div>
      </div>

      {/* Global Cmd+K trigger button */}
      <button
        onClick={toggleSearch}
        className="w-full flex items-center justify-between px-4 py-3 mb-6 bg-card-bg/40 border border-card-border rounded-2xl text-xs text-text-secondary hover:bg-card-bg/75 hover:text-white transition-all duration-200 outline-none"
      >
        <span className="flex items-center">
          <Search className="w-4 h-4 mr-2 opacity-70" />
          Search brain...
        </span>
        <span className="bg-bg-primary border border-card-border px-1.5 py-0.5 rounded-md text-[10px] font-mono text-text-secondary">
          ⌘K
        </span>
      </button>

      {/* Main Navigation menu */}
      <nav className="flex-1 overflow-y-auto space-y-1 pr-1">
        <p className="text-[10px] font-bold text-text-disabled tracking-wider uppercase mb-2 px-3">
          Knowledge Base
        </p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
          return (
            <Link key={item.name} href={item.path}>
              <span
                className={`flex items-center px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 cursor-pointer mb-1 ${
                  isActive
                    ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/10'
                    : 'text-text-secondary hover:bg-card-bg/60 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* Phase 2 items */}
        <p className="text-[10px] font-bold text-text-disabled tracking-wider uppercase mt-6 mb-2 px-3">
          AI Extensions (Soon)
        </p>
        {subMenuItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.name}
              className="flex items-center px-4 py-3 rounded-2xl text-sm font-medium text-text-secondary/40 cursor-not-allowed mb-1"
            >
              <Icon className="w-5 h-5 mr-3 opacity-40" />
              <span>{item.name}</span>
            </div>
          );
        })}
      </nav>

      {/* User Footer Profile & Logout */}
      <div className="border-t border-card-border pt-4 mt-auto flex flex-col space-y-3">
        {user && (
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-3">
              <img
                src={user.avatar || 'https://lh3.googleusercontent.com/a/default-user'}
                alt={user.name}
                className="w-10 h-10 rounded-full border border-card-border object-cover"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white max-w-[120px] truncate">
                  {user.name}
                </span>
                <span className="text-[10px] text-text-secondary font-mono tracking-wider flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-success mr-1"></span>
                  {user.plan.toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-card-bg/80 hover:text-danger rounded-xl text-text-secondary transition-colors duration-200"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
export default Sidebar;
