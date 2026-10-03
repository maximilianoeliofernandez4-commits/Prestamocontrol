import { useMemo } from 'react';
import type { Store } from '@/hooks/useStore';
import { Card, Badge, ProgressBar, EmptyState } from './ui';
import { formatCurrency, monthKey, monthLabel, todayISO } from '@/lib/format';
import { computeSummary, nextInstallment, effectiveMonths } from '@/lib/loan';
import { TrendingUp, Wallet, AlertCircle, DollarSign, BarChart3, Clock } from 'lucide-react';

interface Props {
  store: Store;
}

export function Analytics({ store }: Props) {
  const stats = useMemo(() => {
    const activeLoans = store.state.loans.filter((l) => l.status === 'activa');
    const allLoans = store.state.loans;

    let totalCapitalOut = 0; // capital still owed to you
    let totalCapitalReturned = 0; // capital paid back
    let totalInterestEarned = 0;
    let totalInterestPending = 0;
    let totalCapitalOriginallyLent = 0;

    const overdueClients: { name: string; phone: string; amount: number; sinceDays: number; clientId: string }[] = [];

    for (const loan of allLoans) {
      const summary = computeSummary(loan, store.state.payments);
      totalCapitalOriginallyLent += loan.capital;
      if (loan.status === 'activa') {
        totalCapitalOut += summary.remainingCapital;
        totalInterestPending += summary.remainingInterest;
      }
      totalCapitalReturned += summary.paidCapital;
      totalInterestEarned += summary.paidInterest;

      // Check overdue: if the next installment date is past today
      if (loan.status === 'activa' && !summary.isSettled) {
        const next = nextInstallment(loan, store.state.payments);
        if (next && next.date < todayISO()) {
          const client = store.state.clients.find((c) => c.id === loan.clientId);
          const daysOverdue = Math.floor((new Date(todayISO()).getTime() - new Date(next.date).getTime()) / (1000 * 60 * 60 * 24));
          const existing = overdueClients.find((o) => o.clientId === loan.clientId);
          if (existing) {
            existing.amount += next.amount;
            existing.sinceDays = Math.max(existing.sinceDays, daysOverdue);
          } else {
            overdueClients.push({
              name: client?.name ?? 'Desconocido',
              phone: client?.phone ?? '',
              amount: next.amount,
              sinceDays: daysOverdue,
              clientId: loan.clientId,
            });
          }
        }
      }
    }

    // Last 6 months earnings
    const now = new Date();
    const months: { key: string; label: string; interest: number; capital: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
      const monthPayments = store.state.payments.filter((p) => monthKey(p.date) === key);
      const interest = monthPayments.reduce((s, p) => s + p.toInterest, 0);
      const capital = monthPayments.reduce((s, p) => s + p.toCapital, 0);
      months.push({ key, label, interest, capital });
    }

    const maxMonthValue = Math.max(...months.map((m) => m.interest + m.capital), 1);

    return {
      totalCapitalOut,
      totalCapitalReturned,
      totalInterestEarned,
      totalInterestPending,
      totalCapitalOriginallyLent,
      overdueClients: overdueClients.sort((a, b) => b.sinceDays - a.sinceDays),
      months,
      maxMonthValue,
      activeLoansCount: activeLoans.length,
    };
  }, [store.state]);

  return (
    <div className="space-y-6">
      {/* Capital vs Profit */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Mi Capital</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Capital prestado (pendiente de cobro)</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(stats.totalCapitalOut)}</p>
                <p className="mt-0.5 text-xs text-slate-400">Plata tuya prestada a clientes</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <Wallet size={22} />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ganancia en intereses</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalInterestEarned)}</p>
                <p className="mt-0.5 text-xs text-slate-400">Interés cobrado hasta hoy</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp size={22} />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Disponible para prestar</p>
                <p className="mt-1 text-2xl font-bold text-sky-600">{formatCurrency(stats.totalCapitalReturned)}</p>
                <p className="mt-0.5 text-xs text-slate-400">Capital que ya te devolvieron</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <DollarSign size={22} />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Monthly chart */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={20} className="text-teal-600" />
          <h3 className="text-base font-bold text-slate-900">Ingresos por mes (últimos 6 meses)</h3>
        </div>

        <div className="flex items-end justify-between gap-3 h-48">
          {stats.months.map((m) => {
            const interestH = (m.interest / stats.maxMonthValue) * 100;
            const capitalH = (m.capital / stats.maxMonthValue) * 100;
            return (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-col justify-end h-36 gap-0.5">
                  <div
                    className="w-full rounded-t-md bg-sky-400 transition-all hover:bg-sky-500"
                    style={{ height: `${capitalH}%` }}
                    title={`Capital: ${formatCurrency(m.capital)}`}
                  />
                  <div
                    className="w-full rounded-t-md bg-emerald-500 transition-all hover:bg-emerald-600"
                    style={{ height: `${interestH}%` }}
                    title={`Interés: ${formatCurrency(m.interest)}`}
                  />
                </div>
                <span className="text-xs text-slate-500">{m.label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-emerald-500" />
            <span className="text-slate-600">Interés cobrado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-sky-400" />
            <span className="text-slate-600">Capital recuperado</span>
          </div>
        </div>
      </Card>

      {/* Overdue clients */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-rose-500" />
            <h2 className="text-lg font-bold text-slate-900">Clientes Atrasados</h2>
          </div>
          <span className="text-sm text-slate-400">{stats.overdueClients.length} atrasados</span>
        </div>

        {stats.overdueClients.length === 0 ? (
          <EmptyState
            icon={<Clock size={24} />}
            title="Nadie atrasado"
            description="Todos tus clientes están al día con sus pagos."
          />
        ) : (
          <div className="space-y-3">
            {stats.overdueClients.map((c) => (
              <Card key={c.clientId} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {c.phone} · Atrasado {c.sinceDays} {c.sinceDays === 1 ? 'día' : 'días'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="danger">Atrasado</Badge>
                    <span className="font-bold text-rose-600 text-sm">{formatCurrency(c.amount)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Summary breakdown */}
      <Card className="p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Resumen general</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Capital total prestado (histórico)</span>
            <span className="text-sm font-bold text-slate-900">{formatCurrency(stats.totalCapitalOriginallyLent)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Capital recuperado</span>
            <span className="text-sm font-bold text-sky-600">{formatCurrency(stats.totalCapitalReturned)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Capital pendiente de cobro</span>
            <span className="text-sm font-bold text-slate-900">{formatCurrency(stats.totalCapitalOut)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-sm text-slate-600">Interés cobrado (ganancia)</span>
            <span className="text-sm font-bold text-emerald-600">{formatCurrency(stats.totalInterestEarned)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Interés pendiente de cobro</span>
            <span className="text-sm font-bold text-amber-600">{formatCurrency(stats.totalInterestPending)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-sm text-slate-600">Préstamos activos</span>
            <span className="text-sm font-bold text-slate-900">{stats.activeLoansCount}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
