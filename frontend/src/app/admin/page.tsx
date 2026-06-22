'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Database,
  FolderCode,
  HardDrive,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { AppPageSkeleton } from '@/components/LoadingStates';
import { useAuth } from '@/context/AuthContext';

type AdminStats = {
  totalUsers: number;
  totalProjects: number;
  activeSubscriptions: number;
  totalStorageBytes: number;
  estimatedMonthlyRevenueCents: number;
  stripeConfigured: boolean;
  subscriptionsByPlan: Record<string, number>;
  queue: {
    mode: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  topStorageUsers: Array<{
    userId: string;
    name?: string;
    email?: string;
    plan?: string;
    storageBytes: number;
    filesCount: number;
  }>;
};

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  role: 'user' | 'admin' | 'superadmin';
  status: 'active' | 'suspended' | 'pending';
  isVerified: boolean;
  createdAt: string;
};

type AdminProject = {
  _id: string;
  name: string;
  language?: string;
  framework?: string;
  healthScore: number;
  createdAt: string;
  userId?: {
    name?: string;
    email?: string;
    plan?: string;
    status?: string;
  };
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
};

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, apiFetch } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [search, setSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const loadAdmin = async () => {
    setError(null);
    setLoadingAdmin(true);
    try {
      const [statsData, usersData, projectsData] = await Promise.all([
        apiFetch('/admin/dashboard/stats'),
        apiFetch(`/admin/users?limit=20&search=${encodeURIComponent(search)}`),
        apiFetch(`/admin/projects?limit=20&search=${encodeURIComponent(projectSearch)}`),
      ]);

      setStats(statsData.stats);
      setUsers(usersData.users || []);
      setProjects(projectsData.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل لوحة الإدارة.');
    } finally {
      setLoadingAdmin(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    loadAdmin();
  }, [user, isAdmin]);

  const updateUserRole = async (id: string, role: AdminUser['role']) => {
    setActionId(id);
    try {
      const data = await apiFetch(`/admin/users/${id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      setUsers((prev) => prev.map((item) => (item._id === id ? data.user : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحديث الصلاحيات.');
    } finally {
      setActionId(null);
    }
  };

  const updateUserStatus = async (id: string, status: AdminUser['status']) => {
    setActionId(id);
    try {
      const data = await apiFetch(`/admin/users/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setUsers((prev) => prev.map((item) => (item._id === id ? data.user : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحديث حالة الحساب.');
    } finally {
      setActionId(null);
    }
  };

  const deleteProject = async (project: AdminProject) => {
    if (!confirm(`هل تريد حذف مشروع "${project.name}" نهائياً؟`)) return;
    setActionId(project._id);
    try {
      await apiFetch(`/admin/projects/${project._id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((item) => item._id !== project._id));
      loadAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حذف المشروع.');
    } finally {
      setActionId(null);
    }
  };

  const subscriptionTotal = useMemo(() => {
    if (!stats) return 0;
    return (stats.subscriptionsByPlan.pro || 0) + (stats.subscriptionsByPlan.team || 0);
  }, [stats]);

  if (loading || !user) return <AppPageSkeleton label="جاري تحميل لوحة الإدارة..." />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen bg-bg-primary text-white">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md rounded-[28px] border border-danger/20 bg-danger/10 p-8 text-center glass">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-danger" />
            <h1 className="text-xl font-bold">غير مصرح</h1>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              تحتاج إلى صلاحيات admin أو superadmin لفتح لوحة إدارة DevVault AI.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg-primary text-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 pb-24 lg:p-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-accent-blue">
                SaaS Control Center
              </p>
              <h1 className="text-3xl font-bold tracking-tight">لوحة إدارة DevVault AI</h1>
              <p className="mt-2 text-xs text-text-secondary">
                إدارة المستخدمين، الاشتراكات، المشاريع، وحالة معالجة ZIP من مكان واحد.
              </p>
            </div>
            <button
              onClick={loadAdmin}
              disabled={loadingAdmin}
              className="inline-flex items-center justify-center rounded-2xl border border-card-border bg-card-bg/70 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              {loadingAdmin ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Activity className="ml-2 h-4 w-4" />}
              تحديث البيانات
            </button>
          </header>

          {error && (
            <div className="mb-6 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-xs font-semibold text-danger">
              {error}
            </div>
          )}

          {stats && (
            <>
              <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[28px] border border-card-border bg-card-bg/45 p-6 glass">
                  <div className="mb-5 flex items-center justify-between">
                    <TrendingUp className="h-5 w-5 text-success" />
                    <span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold text-success">MRR</span>
                  </div>
                  <p className="text-3xl font-extrabold">{formatMoney(stats.estimatedMonthlyRevenueCents)}</p>
                  <p className="mt-2 text-xs text-text-secondary">
                    إيراد شهري تقديري {stats.stripeConfigured ? 'مع Stripe مهيأ' : 'بدون مفاتيح Stripe'}
                  </p>
                </div>

                <div className="rounded-[28px] border border-card-border bg-card-bg/45 p-6 glass">
                  <Users className="mb-5 h-5 w-5 text-accent-blue" />
                  <p className="text-3xl font-extrabold">{stats.totalUsers}</p>
                  <p className="mt-2 text-xs text-text-secondary">إجمالي المستخدمين المسجلين</p>
                </div>

                <div className="rounded-[28px] border border-card-border bg-card-bg/45 p-6 glass">
                  <Boxes className="mb-5 h-5 w-5 text-warning" />
                  <p className="text-3xl font-extrabold">{subscriptionTotal}</p>
                  <p className="mt-2 text-xs text-text-secondary">
                    اشتراكات نشطة: Pro {stats.subscriptionsByPlan.pro || 0} / Team {stats.subscriptionsByPlan.team || 0}
                  </p>
                </div>

                <div className="rounded-[28px] border border-card-border bg-card-bg/45 p-6 glass">
                  <Database className="mb-5 h-5 w-5 text-purple" />
                  <p className="text-3xl font-extrabold">{stats.queue.active + stats.queue.waiting}</p>
                  <p className="mt-2 text-xs text-text-secondary">
                    Queue: {stats.queue.mode}، نشط {stats.queue.active}، انتظار {stats.queue.waiting}
                  </p>
                </div>
              </section>

              <section className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.8fr]">
                <div className="rounded-[28px] border border-card-border bg-card-bg/40 p-6 glass">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg font-bold">أعلى المستخدمين استهلاكاً للتخزين</h2>
                    <span className="text-xs text-text-secondary">{formatBytes(stats.totalStorageBytes)} إجمالي</span>
                  </div>
                  <div className="space-y-4">
                    {stats.topStorageUsers.map((item) => {
                      const pct = stats.totalStorageBytes ? Math.max(4, (item.storageBytes / stats.totalStorageBytes) * 100) : 0;
                      return (
                        <div key={item.userId}>
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-semibold text-white">{item.name || item.email || 'Unknown user'}</span>
                            <span className="font-mono text-text-secondary">{formatBytes(item.storageBytes)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/5">
                            <div className="h-full rounded-full bg-[#9DBDFF]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {stats.topStorageUsers.length === 0 && (
                      <p className="py-8 text-center text-xs text-text-secondary">لا توجد ملفات مفهرسة بعد.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-card-border bg-card-bg/40 p-6 glass">
                  <div className="mb-5 flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-accent-blue" />
                    <h2 className="text-lg font-bold">حالة النظام</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-2xl bg-white/5 p-4">
                      <span className="text-text-secondary">المشاريع</span>
                      <p className="mt-2 text-2xl font-bold">{stats.totalProjects}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <span className="text-text-secondary">التخزين</span>
                      <p className="mt-2 text-2xl font-bold">{formatBytes(stats.totalStorageBytes)}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <span className="text-text-secondary">Queue failed</span>
                      <p className="mt-2 text-2xl font-bold text-danger">{stats.queue.failed}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <span className="text-text-secondary">Queue done</span>
                      <p className="mt-2 text-2xl font-bold text-success">{stats.queue.completed}</p>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          <section className="mb-8 rounded-[28px] border border-card-border bg-card-bg/40 p-6 glass">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-bold">إدارة المستخدمين</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  loadAdmin();
                }}
                className="relative w-full md:w-80"
              >
                <Search className="absolute right-4 top-3 h-4 w-4 text-text-secondary" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="بحث بالاسم أو البريد..."
                  className="w-full rounded-2xl border border-card-border bg-bg-primary/50 py-2.5 pr-10 pl-4 text-xs outline-none transition focus:border-accent-blue/50"
                />
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-right text-xs">
                <thead className="text-text-secondary">
                  <tr className="border-b border-card-border">
                    <th className="py-3 font-semibold">المستخدم</th>
                    <th className="py-3 font-semibold">الخطة</th>
                    <th className="py-3 font-semibold">الدور</th>
                    <th className="py-3 font-semibold">الحالة</th>
                    <th className="py-3 font-semibold">تاريخ الانضمام</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item._id} className="border-b border-card-border/50">
                      <td className="py-4">
                        <p className="font-bold text-white">{item.name}</p>
                        <p className="mt-1 font-mono text-[10px] text-text-secondary">{item.email}</p>
                      </td>
                      <td className="py-4 font-mono uppercase">{item.plan}</td>
                      <td className="py-4">
                        <select
                          value={item.role}
                          disabled={actionId === item._id}
                          onChange={(event) => updateUserRole(item._id, event.target.value as AdminUser['role'])}
                          className="rounded-xl border border-card-border bg-bg-primary px-3 py-2 text-xs outline-none"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          {user.role === 'superadmin' && <option value="superadmin">superadmin</option>}
                        </select>
                      </td>
                      <td className="py-4">
                        <select
                          value={item.status}
                          disabled={actionId === item._id}
                          onChange={(event) => updateUserStatus(item._id, event.target.value as AdminUser['status'])}
                          className="rounded-xl border border-card-border bg-bg-primary px-3 py-2 text-xs outline-none"
                        >
                          <option value="active">active</option>
                          <option value="pending">pending</option>
                          <option value="suspended">suspended</option>
                        </select>
                      </td>
                      <td className="py-4 text-text-secondary">{new Date(item.createdAt).toLocaleDateString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[28px] border border-card-border bg-card-bg/40 p-6 glass">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-bold">مراجعة المشاريع</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  loadAdmin();
                }}
                className="relative w-full md:w-80"
              >
                <Search className="absolute right-4 top-3 h-4 w-4 text-text-secondary" />
                <input
                  value={projectSearch}
                  onChange={(event) => setProjectSearch(event.target.value)}
                  placeholder="بحث في المشاريع..."
                  className="w-full rounded-2xl border border-card-border bg-bg-primary/50 py-2.5 pr-10 pl-4 text-xs outline-none transition focus:border-accent-blue/50"
                />
              </form>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {projects.map((project) => (
                <div key={project._id} className="rounded-2xl border border-card-border bg-bg-primary/40 p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue/10">
                        <FolderCode className="h-5 w-5 text-accent-blue" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{project.name}</h3>
                        <p className="mt-1 text-[10px] text-text-secondary">
                          {project.userId?.email || 'Unknown owner'} • {project.language || 'generic'} / {project.framework || 'vanilla'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteProject(project)}
                      disabled={actionId === project._id}
                      className="rounded-xl p-2 text-text-secondary transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                      title="Force delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-secondary">
                    <span>Health {project.healthScore}%</span>
                    <span>{new Date(project.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <div className="col-span-full py-12 text-center text-xs text-text-secondary">
                  لا توجد مشاريع مطابقة.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
