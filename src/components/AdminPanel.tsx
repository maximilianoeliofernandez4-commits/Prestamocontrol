import { useMemo } from 'react';
import type { Store } from '@/hooks/useStore';
import { Card, Badge, ProgressBar } from './ui';
import { formatCurrency, formatDate, todayISO } from '@/lib/format';
import { computeSummary, overdueDetails } from '@/lib/loan';
import {
  Shield, Users, Wallet, TrendingUp, Clock, Mail, CalendarDays,
  Activity, AlertCircle, ChevronDown, ChevronRight, UserCircle,
} from 'lucide-react';
import { useState } from 'react';

interface Props {
  store: Store;
}

export function AdminPanel({ store }: Props) {
  const collaborators = useMemo(() => {
    const userIds = new Set<string>();
    store.state.clients.forEach((c) => userIds.add(c.userId));
    store.state.loans.forEach((l) => userIds.add(l.userId));
    store.state.payments.forEach((p) => userIds.add(p.userId));

    const list = Array.from(userIds).map((uid) => {
      const p = store.profiles[uid];
      const clients = store.state.clients.filter((c) => c.userId === uid);
      const loans = store.state.loans.filter((l) => l.userId === uid);
      const payments = store.state.payments.filter((p) => p.userId === uid);
      const activeLoans = loans.filter((l) => l.status === 'activa');
      const totalLent = loans.reduce((s, l) => s + l.capital, 0);
      const activeCapital = activeLoans.reduce((s, l) => s + l.capital, 0);
      const totalInterest = payments.reduce((s, p) => s + p.toInterest, 0);
      const totalCapital = payments.reduce((s, p) => s + p.toCapital, 0);

      // Capital currently out (remaining)
      let capitalOut = 0;
      let interestPending = 0;
      let overdueCount = 0;
      for (const loan of activeLoans) {
        const summary = computeSummary(loan, payments);
        capitalOut += summary.remainingCapital;
        interestPending += summary.remainingInterest;
        const overdue = overdueDetails(loan, payments, todayISO());
        if (overdue) overdueCount++;
      }

      // Last activity date
      const lastPaymentDate = payments.length > 0
        ? payments.sort((a, b) => b.date.localeCompare(a.date))[0].date
        : '';
      const lastLoanDate = loans.length > 0
        ? loans.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt
        : '';
      const lastActivity = [lastPaymentDate, lastLoanDate].filter(Boolean).sort().reverse()[0] || '';

      // Payments this month
      const currentMonth = todayISO().slice(0, 7);
      const monthPayments = payments.filter((p) => p.date.slice(0, 7) === currentMonth);
      const monthInterest = monthPayments.reduce((s, p) => s + p.toInterest, 0);
      const monthCapital = monthPayments.reduce((s, p) => s + p.toCapital, 0);

      return {
        uid,
        name: p?.display_name || p?.email || 'Usuario',
        email: p?.email || '',
        role: p?.role || 'colaborador',
        createdAt: p?.created_at || '',
        clients: clients.length,
        loans: loans.length,
        activeLoans: activeLoans.length,
        payments: payments.length,
        totalLent,
        activeCapital,
        capitalOut,
        interestPending,
        totalInterest,
        totalCapital,
        overdueCount,
        lastActivity,
        monthInterest,
        monthCapital,
        recentPayments: payments.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
        recentLoans: loans.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3),
      };
    });

    return list.sort((a, b) => b.totalLent - a.totalLent);
  }, [store.state, store.profiles]);

  const totals = useMemo(() => {
    const totalLent = collaborators.reduce((s, c) => s + c.totalLent, 0);
    const totalInterest = collaborators.reduce((s, c) => s + c.totalInterest, 0);
    const totalCapital = collaborators.reduce((s, c) => s + c.totalCapital, 0);
    const totalActive = collaborators.reduce((s, c) => s + c.activeCapital, 0);
    const totalOut = collaborators.reduce((s, c) => s + c.capitalOut, 0);
    const totalOverdue = collaborators.reduce((s, c) => s + c.overdueCount, 0);
    return { totalLent, totalInterest, totalCapital, totalActive, totalOut, totalOverdue };
  }, [collaborators]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Shield size={22} className="text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">Panel de Administrador</h2>
        </div>
        <p className="text-sm text-slate-500">
          Acá ves los movimientos de todas las personas que usan tu sistema. Cada colaborador entra con su propia cuenta al mismo link y maneja sus clientes. Vos ves todo.
        </p>
      </div>

      {/* Global totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryStat
          label="Prestado (histórico)"
          value={formatCurrency(totals.totalLent)}
          icon={<Wallet size={18} />}
          color="teal"
        />
        <SummaryStat
          label="Capital activo"
          value={formatCurrency(totals.totalActive)}
          icon={<Activity size={18} />}
          color="sky"
        />
        <SummaryStat
          label="Por cobrar"
          value={formatCurrency(totals.totalOut)}
          icon={<Wallet size={18} />}
          color="amber"
        />
        <SummaryStat
          label="Interés cobrado"
          value={formatCurrency(totals.totalInterest)}
          icon={<TrendingUp size={18} />}
          color="emerald"
        />
        <SummaryStat
          label="Capital recuperado"
          value={formatCurrency(totals.totalCapital)}
          icon={<Wallet size={18} />}
          color="sky"
        />
        <SummaryStat
          label="Préstamos atrasados"
          value={String(totals.totalOverdue)}
          icon={<AlertCircle size={18} />}
          color="rose"
        />
      </div>

      {/* Collaborator count */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Users size={16} />
        <span>{collaborators.length} {collaborators.length === 1 ? 'colaborador' : 'colaboradores'} en el sistema</span>
      </div>

      {/* Per-collaborator breakdown */}
      <div className="space-y-4">
        {collaborators.map((c) => (
          <CollaboratorCard key={c.uid} collaborator={c} store={store} />
        ))}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </Card>
  );
}

interface CollaboratorInfo {
  uid: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  clients: number;
  loans: number;
  activeLoans: number;
  payments: number;
  totalLent: number;
  activeCapital: number;
  capitalOut: number;
  interestPending: number;
  totalInterest: number;
  totalCapital: number;
  overdueCount: number;
  lastActivity: string;
  monthInterest: number;
  monthCapital: number;
  recentPayments: { id: string; amount: number; date: string; receiptNo: string; toInterest: number; toCapital: number; loanId: string }[];
  recentLoans: { id: string; capital: number; startDate: string; status: string; clientId: string }[];
}

function CollaboratorCard({ collaborator: c, store }: { collaborator: CollaboratorInfo; store: Store }) {
  const [expanded, setExpanded] = useState(false);

  const daysSinceActivity = c.lastActivity
    ? Math.floor((new Date(todayISO()).getTime() - new Date(c.lastActivity).getTime()) / 86400000)
    : null;

  return (
    <Card className="overflow-hidden">
      {/* Header row */}
      <div
        className="flex cursor-pointer items-center justify-between p-5 transition-colors hover:bg-slate-50/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white font-bold text-sm">
            {c.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900 truncate">{c.name}</p>
              <Badge variant={c.role === 'admin' ? 'info' : 'neutral'}>
                {c.role === 'admin' ? 'Admin' : 'Colaborador'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
              <span className="flex items-center gap-1 truncate">
                <Mail size={12} /> {c.email}
              </span>
              {c.createdAt && (
                <span className="flex items-center gap-1 shrink-0">
                  <CalendarDays size={12} /> {formatDate(c.createdAt.slice(0, 10))}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {c.overdueCount > 0 && (
            <Badge variant="danger">{c.overdueCount} atrasado{c.overdueCount !== 1 ? 's' : ''}</Badge>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">Capital activo</p>
            <p className="text-sm font-bold text-slate-900">{formatCurrency(c.activeCapital)}</p>
          </div>
          {expanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </div>
      </div>

      {/* Stats grid (always visible) */}
      <div className="grid grid-cols-2 gap-2 px-5 pb-4 sm:grid-cols-4 lg:grid-cols-6">
        <MiniStat label="Clientes" value={String(c.clients)} />
        <MiniStat label="Préstamos" value={String(c.loans)} />
        <MiniStat label="Activos" value={String(c.activeLoans)} />
        <MiniStat label="Pagos" value={String(c.payments)} />
        <MiniStat label="Por cobrar" value={formatCurrency(c.capitalOut)} />
        <MiniStat label="Interés pend." value={formatCurrency(c.interestPending)} />
      </div>

      {/* This month summary */}
      <div className="mx-5 mb-4 rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Este mes</span>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-600">
              Interés: <strong className="text-emerald-600">{formatCurrency(c.monthInterest)}</strong>
            </span>
            <span className="text-slate-600">
              Capital: <strong className="text-sky-600">{formatCurrency(c.monthCapital)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Last activity */}
      {daysSinceActivity !== null && (
        <div className="mx-5 mb-4 flex items-center gap-2 text-xs text-slate-400">
          <Clock size={14} />
          <span>
            Última actividad: {formatDate(c.lastActivity)}
            <span className="ml-1.5">
              ({daysSinceActivity === 0 ? 'hoy' : daysSinceActivity === 1 ? 'ayer' : `hace ${daysSinceActivity} días`})
            </span>
          </span>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-5">
          {/* Financial breakdown */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Resumen financiero</p>
            <div className="space-y-2.5">
              <DetailRow label="Capital total prestado (histórico)" value={formatCurrency(c.totalLent)} />
              <DetailRow label="Capital activo (prestado ahora)" value={formatCurrency(c.activeCapital)} />
              <DetailRow label="Capital pendiente de cobro" value={formatCurrency(c.capitalOut)} />
              <DetailRow label="Capital recuperado" value={formatCurrency(c.totalCapital)} color="text-sky-600" />
              <DetailRow label="Interés total cobrado" value={formatCurrency(c.totalInterest)} color="text-emerald-600" />
              <DetailRow label="Interés pendiente de cobro" value={formatCurrency(c.interestPending)} color="text-amber-600" />
            </div>
          </div>

          {/* Recent loans */}
          {c.recentLoans.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Préstamos recientes</p>
              <div className="space-y-2">
                {c.recentLoans.map((loan) => {
                  const client = store.state.clients.find((cl) => cl.id === loan.clientId);
                  return (
                    <div key={loan.id} className="flex items-center justify-between rounded-lg bg-white border border-slate-100 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {client?.name ?? 'Cliente'}
                        </p>
                        <p className="text-xs text-slate-400">{formatDate(loan.startDate)} · {loan.status}</p>
                      </div>
                      <span className="text-sm font-bold text-slate-700 shrink-0">{formatCurrency(loan.capital)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent payments */}
          {c.recentPayments.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Pagos recientes</p>
              <div className="space-y-2">
                {c.recentPayments.map((p) => {
                  const loan = store.state.loans.find((l) => l.id === p.loanId);
                  const client = loan ? store.state.clients.find((cl) => cl.id === loan.clientId) : null;
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-white border border-slate-100 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {client?.name ?? 'Cliente'} · {formatCurrency(p.amount)}
                        </p>
                        <p className="text-xs text-slate-400">{formatDate(p.date)} · {p.receiptNo}</p>
                      </div>
                      <span className="text-xs font-medium text-emerald-600 shrink-0">
                        {p.toInterest > 0 && `Int: ${formatCurrency(p.toInterest)}`}
                        {p.toInterest > 0 && p.toCapital > 0 && ' · '}
                        {p.toCapital > 0 && `Cap: ${formatCurrency(p.toCapital)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No activity */}
          {c.recentPayments.length === 0 && c.recentLoans.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <UserCircle size={18} />
              <span>Este colaborador todavía no registró movimientos.</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm font-bold ${color ?? 'text-slate-900'}`}>{value}</span>
    </div>
  );
}
