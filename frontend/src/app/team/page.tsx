'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { AppPageSkeleton, SectionSkeleton } from '@/components/LoadingStates';
import { useLanguage } from '@/context/LanguageContext';
import {
  Users,
  Plus,
  Mail,
  UserPlus,
  Shield,
  Trash2,
  FolderCode,
  Lock,
  Zap,
  CheckCircle2
} from 'lucide-react';

export default function TeamBrainPage() {
  const { user, loading, apiFetch } = useAuth();
  const router = useRouter();
  const { t, dir } = useLanguage();

  const [members, setMembers] = useState<any[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [loadingTeam, setLoadingTeam] = useState(true);

  // Invite form state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const fetchMembers = async () => {
    try {
      const data = await apiFetch('/workspaces/members');
      setWorkspaceName(data.workspace?.name || t('teamWorkspace'));
      
      // format members
      setMembers(data.workspace?.members || []);
    } catch (err) {
      console.error('[Team]: Fetch failed:', err);
    } finally {
      setLoadingTeam(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchMembers();
  }, [user]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const data = await apiFetch('/workspaces/members', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      setInviteSuccess(data.message || t('addMemberSuccess'));
      setInviteEmail('');
      setShowInvite(false);
      fetchMembers(); // reload members list
    } catch (err: any) {
      setInviteError(err.message || t('addMemberFailed'));
    } finally {
      setInviting(false);
    }
  };

  if (loading || !user) return <AppPageSkeleton label={t('loadingTeamBrain')} />;

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto max-w-5xl mx-auto flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t('teamBrainTitle')}</h2>
            <p className="text-xs text-text-secondary mt-1">
              {t('teamBrainSubtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="flex items-center px-4 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-xs font-semibold rounded-2xl transition-all shadow-md shadow-accent-blue/10 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 ml-1.5 ltr:mr-1.5 ltr:ml-0" />
            {t('inviteMember')}
          </button>
        </div>

        {/* Invite Member panel */}
        {showInvite && (
          <div className="mb-8 bg-card-bg/60 border border-card-border p-6 rounded-[28px] glass">
            <h3 className="font-bold text-sm mb-4">{t('inviteDeveloper')}</h3>
            {inviteError && (
              <div className="mb-4 p-3 bg-danger/10 border border-danger/25 text-danger rounded-xl text-xs font-medium">
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="mb-4 p-3 bg-success/10 border border-success/25 text-success rounded-xl text-xs font-medium flex items-center">
                <CheckCircle2 className="w-4 h-4 ml-2" />
                {inviteSuccess}
              </div>
            )}
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-2 relative">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('userEmail')}</label>
                  <div className="relative mt-1">
                    <Mail className="absolute right-4 ltr:left-4 ltr:right-auto top-3.5 w-4 h-4 text-text-secondary" />
                    <input
                      type="email"
                      placeholder="teammate@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      disabled={inviting}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 pr-11 pl-4 ltr:pl-11 ltr:pr-4 text-xs text-white outline-none focus:border-accent-blue/50"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('memberRole')}</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                    disabled={inviting}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3.5 px-4 text-xs text-white outline-none focus:border-accent-blue/50 mt-1"
                  >
                    <option value="member">{t('roleMemberDesc')}</option>
                    <option value="admin">{t('roleAdminDesc')}</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  disabled={inviting}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-semibold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail}
                  className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-semibold"
                >
                  {inviting ? t('addingMember') : t('addTeamMember')}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start select-text">
          {/* Members list (2/3 width) */}
          <div className="md:col-span-2 bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass">
            <div className="flex items-center gap-2.5 mb-6">
              <Users className="w-5 h-5 text-accent-blue" />
              <h3 className="font-bold text-sm text-white">{t('activeMembers', { count: members.length })}</h3>
            </div>

            {loadingTeam ? (
              <SectionSkeleton rows={3} className="border-0 bg-transparent p-0" />
            ) : members.length > 0 ? (
              <div className="space-y-3.5">
                {members.map((member, i) => {
                  const u = member.userId;
                  const isOwner = member.role === 'owner';
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={u.avatar || 'https://lh3.googleusercontent.com/a/default-user'}
                          alt={u.name}
                          className="w-10 h-10 rounded-full border border-card-border object-cover"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white">{u.name}</span>
                          <span className="text-[10px] text-text-secondary mt-0.5 font-mono">{u.email}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 bg-accent-blue/10 border border-accent-blue/15 text-[9px] font-mono font-bold text-accent-blue rounded-full uppercase">
                          {member.role}
                        </span>
                        {!isOwner && (
                          <button
                            className="p-1.5 hover:bg-danger/10 hover:text-danger rounded-lg text-text-secondary transition-colors"
                            title={t('removeMember')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-text-secondary">
                {t('noActiveMembers')}
              </div>
            )}
          </div>

          {/* Shared knowledge permissions card (1/3 width) */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center">
              <Lock className="w-4 h-4 text-warning ml-1.5" />
              {t('workspacePermissions')}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {t('rbacNotice')}
            </p>
            <div className="p-3.5 bg-white/5 border border-white/5 rounded-xl flex items-start gap-3">
              <Zap className="w-4 h-4 text-accent-blue mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-text-secondary leading-relaxed">
                {t('knowledgeLock')}
              </p>
            </div>
          </div>
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}
