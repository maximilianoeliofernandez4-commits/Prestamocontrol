import { useMemo } from 'react';
import type { Store } from '@/hooks/useStore';
import { Card, Badge, ProgressBar, Button, EmptyState } from './ui';
import { formatCurrency, formatDate, monthKey, todayISO } from '@/lib/format';
import { computeSummary, overdueDetails, nextInstallment } from '@/lib/loan';
import { Users, Wallet, TrendingUp, AlertCircle, ArrowRight, Search, DollarSign, CalendarClock } from 'lucide-react';

interface Props {
  store: Store;
  search: string;
  onClientClick: (clientId: string) => void;
  onNewClient: () => void;
  onNewLoan: () => void;
}

export function Dashboard({ store, search, onClientClick, onNewClient, onNewLoan }: Props) {
  const stats = useMemo(() => {
    const activeLoans = store.state.loans.filter((l) => l.status === 'activa');
    const totalCapital = activeLoans.reduce((s, l) => s + l.capital, 0);
    const currentMonth = monthKey(todayISO());

    let monthInterest = 0;
    let totalCapitalReturned = 0;
    let totalCapitalOut = 0;
    let clientsUpToDate = 0;
    let clientsPending = 0;

    const clientStatus = new Map<string, boolean>();

    for (const loan of store.state.loans) {
      const summary = computeSummary(loan, store.state.payments);
      totalCapitalReturned += summary.paidCapital;
      if (loan.status === 'activa') {
        totalCapitalOut += summary.remainingCapital;
      }

      const monthPayments = store.state.payments
        .filter((p) => p.loanId === loan.id && monthKey(p.date) === currentMonth);
      monthInterest += monthPayments.reduce((s, p) => s + p.toInterest, 0);

      if (loan.status === 'activa') {
        const overdue = overdueDetails(loan, store.state.payments, todayISO());
        const isUpToDate = summary.isSettled || (summary.paymentCount > 0 && !overdue);
        const prev = clientStatus.get(loan.clientId);
        clientStatus.set(loan.clientId, prev !== undefined ? prev && isUpToDate : isUpToDate);
      }
    }

    for (const [, upToDate] of clientStatus) {
      if (upToDate) clientsUpToDate++;
      else clientsPending++;
    }

    return {
      totalCapital,
      monthInterest,
      totalCapitalReturned,
      totalCapitalOut,
      clientsUpToDate,
      clientsPending,
      activeLoans: activeLoans.length,
    };
  }, [store.state]);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return store.state.clients;
    return store.state.clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [store.state.clients, search]);

  const recentPayments = useMemo(() => {
    return [...store.state.payments]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map((p) => {
        const loan = store.state.loans.find((l) => l.id === p.loanId);
        const client = loan ? store.state.clients.find((c) => c.id === loan.clientId) : null;
        return { payment: p, client, loan };
      });
  }, [store.state]);

  const upcomingPayments = useMemo(() => {
    const today = todayISO();
    const items: { clientName: string; clientId: string; date: string; amount: number; freqLabel: string; isOverdue: boolean }[] = [];
    for (const loan of store.state.loans.filter((l) => l.status === 'activa')) {
      const next = nextInstallment(loan, store.state.payments);
      if (!next) continue;
      const client = store.state.clients.find((c) => c.id === loan.clientId);
      if (!client) continue;
      const overdue = overdueDetails(loan, store.state.payments, today);
      const freqLabel = loan.frequency === 'diario' ? 'Diario' : loan.frequency === 'semanal' ? 'Semanal' : 'Mensual';
      items.push({
        clientName: client.name,
        clientId: client.id,
        date: next.date,
        amount: next.amount,
        freqLabel,
        isOverdue: !!overdue || next.date < today,
      });
    }
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [store.state]);

  const clientLoans = (clientId: string) => {
    return store.state.loans.filter((l) => l.clientId === clientId && l.status === 'activa');
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Capital Prestado</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(stats.totalCapital)}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Wallet size={22} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Ganancia del Mes</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{formatCurrency(stats.monthInterest)}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={22} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Clientes al Día</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.clientsUpToDate}</p>
              <p className="mt-0.5 text-xs text-amber-500">{stats.clientsPending} pendientes</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Users size={22} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Préstamos Activos</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.activeLoans}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <AlertCircle size={22} />
            </div>
          </div>
        </Card>
      </div>

      {/* Capital vs Profit mini-summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Wallet size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Tu capital prestado (por cobrar)</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(stats.totalCapitalOut)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Ganancia de este mes</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.monthInterest)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Capital recuperado (disponible)</p>
              <p className="text-lg font-bold text-sky-600">{formatCurrency(stats.totalCapitalReturned)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Upcoming Payments */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock size={20} className="text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">Próximos Cobros</h2>
        </div>
        {upcomingPayments.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-400">No hay cobros próximos registrados</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {upcomingPayments.map((item, idx) => {
              const isOverdue = item.isOverdue;
              const dateObj = new Date(item.date + 'T00:00:00');
              const today = new Date(todayISO() + 'T00:00:00');
              const diffDays = Math.round((dateObj.getTime() - today.getTime()) / 86400000);
              const dayLabel = isOverdue
                ? diffDays === 0 ? 'Hoy' : `${Math.abs(diffDays)} días atrasado${Math.abs(diffDays) !== 1 ? 's' : ''}`
                : diffDays === 0 ? 'Hoy' : diffDays === 1 ? 'Mañana' : `En ${diffDays} días`;
              return (
                <Card
                  key={idx}
                  className={`p-4 cursor-pointer transition-all hover:shadow-md ${isOverdue ? 'border-amber-200 bg-amber-50/30' : ''}`}
                  onClick={() => onClientClick(item.clientId)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{item.clientName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(item.date)}</p>
                    </div>
                    {isOverdue && <Badge variant="danger">Atrasado</Badge>}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900">{formatCurrency(item.amount)}</span>
                    <span className={`text-xs font-medium ${isOverdue ? 'text-amber-600' : 'text-slate-400'}`}>{dayLabel}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-[11px] text-slate-400">{item.freqLabel}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Clients List */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Clientes</h2>
            <span className="text-sm text-slate-400">{filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}</span>
          </div>

          {filteredClients.length === 0 ? (
            <EmptyState
              icon={<Search size={24} />}
              title="Sin resultados"
              description="No se encontraron clientes con ese criterio de búsqueda."
              action={<Button variant="outline" onClick={onNewClient}>Agregar cliente</Button>}
            />
          ) : (
            <div className="space-y-3">
              {filteredClients.map((client) => {
                const loans = clientLoans(client.id);
                const totalRemaining = loans.reduce((s, l) => s + computeSummary(l, store.state.payments).remainingCapital, 0);
                const hasPending = loans.some((l) => {
                  const sum = computeSummary(l, store.state.payments);
                  const overdue = overdueDetails(l, store.state.payments, todayISO());
                  return !sum.isSettled && (sum.remainingInterest > 0 || !!overdue);
                });
                return (
                  <Card key={client.id} className="p-4 transition-all hover:shadow-md cursor-pointer group" >
                    <div onClick={() => onClientClick(client.id)} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white font-bold text-sm">
                          {client.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{client.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {loans.length} {loans.length === 1 ? 'préstamo' : 'préstamos'} · Saldo: {formatCurrency(totalRemaining)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {hasPending ? (
                          <Badge variant="warning">Pendiente</Badge>
                        ) : (
                          <Badge variant="success">Al día</Badge>
                        )}
                        <ArrowRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-teal-500" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div>
          <h2 className="mb-3 text-lg font-bold text-slate-900">Pagos Recientes</h2>
          {recentPayments.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-slate-400">No hay pagos registrados aún</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentPayments.map(({ payment, client }) => (
                <Card key={payment.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{client?.name ?? 'Cliente'}</p>
                      <p className="text-xs text-slate-400">{formatDate(payment.date)} · {payment.receiptNo}</p>
                    </div>
                    <span className="font-bold text-emerald-600 text-sm shrink-0">{formatCurrency(payment.amount)}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onNewClient}>
              <Users size={18} /> Cliente
            </Button>
            <Button variant="outline" className="flex-1" onClick={onNewLoan}>
              <Wallet size={18} /> Préstamo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
