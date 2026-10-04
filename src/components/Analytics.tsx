import { useMemo, useState } from 'react';
import type { Store } from '@/hooks/useStore';
import type { Client } from '@/types';
import { Card, Badge, EmptyState } from './ui';
import { formatCurrency, monthKey, monthLabel, todayISO } from '@/lib/format';
import { computeSummary, overdueDetails } from '@/lib/loan';
import { OverdueDetailModal } from './OverdueDetailModal';
import {
  TrendingUp, Wallet, AlertCircle, DollarSign, Clock, ChevronRight,
  BarChart3, PieChart as PieIcon, TrendingDown, Activity, Users, Layers,
} from 'lucide-react';

interface Props {
  store: Store;
}

type ChartType = 'barras' | 'lineas' | 'area' | 'circular' | 'donut';

const CHART_TYPES: { value: ChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'barras', label: 'Barras', icon: <BarChart3 size={16} /> },
  { value: 'lineas', label: 'Líneas', icon: <TrendingUp size={16} /> },
  { value: 'area', label: 'Área', icon: <Activity size={16} /> },
  { value: 'circular', label: 'Circular', icon: <PieIcon size={16} /> },
  { value: 'donut', label: 'Dona', icon: <Layers size={16} /> },
];

const CHART_COLORS = ['#0d9488', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function Analytics({ store }: Props) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const stats = useMemo(() => {
    const activeLoans = store.state.loans.filter((l) => l.status === 'activa');
    const allLoans = store.state.loans;

    let totalCapitalOut = 0;
    let totalCapitalReturned = 0;
    let totalInterestPending = 0;
    let totalCapitalOriginallyLent = 0;
    let totalInterestEarned = 0;

    const overdueClients: { name: string; phone: string; amount: number; sinceDays: number; clientId: string }[] = [];

    for (const loan of allLoans) {
      const summary = computeSummary(loan, store.state.payments);
      totalCapitalOriginallyLent += loan.capital;
      totalInterestEarned += summary.paidInterest;
      if (loan.status === 'activa') {
        totalCapitalOut += summary.remainingCapital;
        totalInterestPending += summary.remainingInterest;
      }
      totalCapitalReturned += summary.paidCapital;

      if (loan.status === 'activa' && !summary.isSettled) {
        const overdue = overdueDetails(loan, store.state.payments, todayISO());
        if (overdue) {
          const client = store.state.clients.find((c) => c.id === loan.clientId);
          const daysOverdue = Math.floor((new Date(todayISO()).getTime() - new Date(overdue.sinceDate).getTime()) / (1000 * 60 * 60 * 24));
          const existing = overdueClients.find((o) => o.clientId === loan.clientId);
          if (existing) {
            existing.amount += overdue.amount;
            existing.sinceDays = Math.max(existing.sinceDays, daysOverdue);
          } else {
            overdueClients.push({
              name: client?.name ?? 'Desconocido',
              phone: client?.phone ?? '',
              amount: overdue.amount,
              sinceDays: daysOverdue,
              clientId: loan.clientId,
            });
          }
        }
      }
    }

    const currentMonth = monthKey(todayISO());
    const currentMonthLabel = monthLabel(todayISO());
    const currentMonthInterest = store.state.payments
      .filter((payment) => monthKey(payment.date) === currentMonth)
      .reduce((sum, payment) => sum + payment.toInterest, 0);

    // Last 6 months earnings
    const now = new Date();
    const months: { key: string; label: string; interest: number; capital: number; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
      const monthPayments = store.state.payments.filter((p) => monthKey(p.date) === key);
      const interest = monthPayments.reduce((s, p) => s + p.toInterest, 0);
      const capital = monthPayments.reduce((s, p) => s + p.toCapital, 0);
      months.push({ key, label, interest, capital, total: interest + capital });
    }

    const maxMonthValue = Math.max(...months.map((m) => m.total), 1);

    // Client distribution by loan count
    const clientLoanCount: { name: string; count: number; capital: number }[] = [];
    for (const client of store.state.clients) {
      const clientLoans = store.state.loans.filter((l) => l.clientId === client.id && l.status === 'activa');
      if (clientLoans.length > 0) {
        const capital = clientLoans.reduce((s, l) => s + l.capital, 0);
        clientLoanCount.push({ name: client.name, count: clientLoans.length, capital });
      }
    }
    clientLoanCount.sort((a, b) => b.capital - a.capital);

    // Capital distribution: out vs returned vs pending interest
    const capitalDistribution = [
      { label: 'Capital recuperado', value: totalCapitalReturned, color: '#0ea5e9' },
      { label: 'Capital prestado', value: totalCapitalOut, color: '#0d9488' },
      { label: 'Interés pendiente', value: totalInterestPending, color: '#f59e0b' },
      { label: 'Interés cobrado', value: totalInterestEarned, color: '#10b981' },
    ];

    // Loan status distribution
    const statusCounts = { activa: 0, liquidada: 0, cancelada: 0 };
    for (const loan of allLoans) {
      statusCounts[loan.status]++;
    }
    const loanStatusDistribution = [
      { label: 'Activas', value: statusCounts.activa, color: '#0d9488' },
      { label: 'Liquidadas', value: statusCounts.liquidada, color: '#10b981' },
      { label: 'Canceladas', value: statusCounts.cancelada, color: '#94a3b8' },
    ];

    // Frequency distribution
    const freqCounts = { diario: 0, semanal: 0, mensual: 0 };
    for (const loan of allLoans) {
      freqCounts[loan.frequency]++;
    }
    const freqDistribution = [
      { label: 'Diario', value: freqCounts.diario, color: '#0ea5e9' },
      { label: 'Semanal', value: freqCounts.semanal, color: '#f59e0b' },
      { label: 'Mensual', value: freqCounts.mensual, color: '#0d9488' },
    ];

    return {
      totalCapitalOut,
      totalCapitalReturned,
      currentMonthLabel,
      currentMonthInterest,
      totalInterestPending,
      totalCapitalOriginallyLent,
      totalInterestEarned,
      overdueClients: overdueClients.sort((a, b) => b.sinceDays - a.sinceDays),
      months,
      maxMonthValue,
      activeLoansCount: activeLoans.length,
      clientLoanCount,
      capitalDistribution,
      loanStatusDistribution,
      freqDistribution,
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
                <p className="text-sm text-slate-500">Ganancia de {stats.currentMonthLabel}</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{formatCurrency(stats.currentMonthInterest)}</p>
                <p className="mt-0.5 text-xs text-slate-400">Solo intereses cobrados este mes</p>
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

      {/* Interactive Monthly Chart */}
      <MonthlyChartCard
        months={stats.months}
        maxMonthValue={stats.maxMonthValue}
      />

      {/* Capital Distribution Chart */}
      <DistributionChartCard
        title="Distribución del Capital"
        subtitle="Cómo se reparte tu plata entre capital e intereses"
        icon={<Wallet size={20} />}
        data={stats.capitalDistribution}
        defaultChartType="donut"
        formatAsCurrency
      />

      {/* Two columns: Loan status + Frequency */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DistributionChartCard
          title="Estado de los Préstamos"
          subtitle="Activos vs liquidados vs cancelados"
          icon={<BarChart3 size={20} />}
          data={stats.loanStatusDistribution}
          defaultChartType="circular"
        />
        <DistributionChartCard
          title="Frecuencia de Pagos"
          subtitle="Cómo pagan tus clientes"
          icon={<Activity size={20} />}
          data={stats.freqDistribution}
          defaultChartType="donut"
        />
      </div>

      {/* Top clients by capital */}
      {stats.clientLoanCount.length > 0 && (
        <ClientCapitalChartCard clients={stats.clientLoanCount} />
      )}

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
            {stats.overdueClients.map((c) => {
              const client = store.state.clients.find((cl) => cl.id === c.clientId);
              return (
                <Card
                  key={c.clientId}
                  className="cursor-pointer p-4 transition-all hover:border-rose-300 hover:shadow-md"
                  onClick={() => client && setSelectedClient(client)}
                >
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
                      <ChevronRight size={18} className="text-slate-300" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed summary */}
      <Card className="p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Ganancias por mes</h3>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.months.map((month) => (
            <div key={month.key} className={`rounded-xl border p-3 ${month.key === monthKey(todayISO()) ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
              <p className="text-xs capitalize text-slate-500">{month.label}</p>
              <p className="mt-1 text-sm font-bold text-emerald-600">{formatCurrency(month.interest)}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Intereses</p>
            </div>
          ))}
        </div>
        <h3 className="border-t border-slate-100 pt-5 text-base font-bold text-slate-900 mb-4">Resumen general</h3>
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
            <span className="text-sm text-slate-600">Interés cobrado en {stats.currentMonthLabel}</span>
            <span className="text-sm font-bold text-emerald-600">{formatCurrency(stats.currentMonthInterest)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Interés pendiente de cobro</span>
            <span className="text-sm font-bold text-amber-600">{formatCurrency(stats.totalInterestPending)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Total interés cobrado (histórico)</span>
            <span className="text-sm font-bold text-emerald-600">{formatCurrency(stats.totalInterestEarned)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-sm text-slate-600">Préstamos activos</span>
            <span className="text-sm font-bold text-slate-900">{stats.activeLoansCount}</span>
          </div>
        </div>
      </Card>

      <OverdueDetailModal
        open={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        store={store}
        client={selectedClient}
      />
    </div>
  );
}

// ─── Chart Type Selector ───

function ChartTypeSelector({ value, onChange, types }: { value: ChartType; onChange: (t: ChartType) => void; types: ChartType[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CHART_TYPES.filter((t) => types.includes(t.value)).map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
            value === t.value
              ? 'bg-teal-100 text-teal-700 ring-1 ring-teal-500/20'
              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Monthly Chart (bar, line, area) ───

interface MonthData { key: string; label: string; interest: number; capital: number; total: number; }

function MonthlyChartCard({ months, maxMonthValue }: { months: MonthData[]; maxMonthValue: number }) {
  const [chartType, setChartType] = useState<ChartType>('barras');
  const [hovered, setHovered] = useState<number | null>(null);

  const validTypes: ChartType[] = ['barras', 'lineas', 'area'];

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-teal-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Ingresos por mes (últimos 6 meses)</h3>
            <p className="text-xs text-slate-400">Interés cobrado y capital recuperado por mes</p>
          </div>
        </div>
        <ChartTypeSelector value={chartType} onChange={setChartType} types={validTypes} />
      </div>

      {/* Tooltip */}
      {hovered !== null && months[hovered] && (
        <div className="mb-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
          <span className="font-semibold text-slate-700">{months[hovered].label}</span>
          <span className="mx-2 text-slate-300">|</span>
          <span className="text-emerald-600 font-medium">Interés: {formatCurrency(months[hovered].interest)}</span>
          <span className="mx-2 text-slate-300">|</span>
          <span className="text-sky-600 font-medium">Capital: {formatCurrency(months[hovered].capital)}</span>
          <span className="mx-2 text-slate-300">|</span>
          <span className="text-slate-700 font-medium">Total: {formatCurrency(months[hovered].total)}</span>
        </div>
      )}

      {chartType === 'barras' && (
        <BarChart months={months} maxMonthValue={maxMonthValue} hovered={hovered} setHovered={setHovered} />
      )}
      {chartType === 'lineas' && (
        <LineChart months={months} maxMonthValue={maxMonthValue} hovered={hovered} setHovered={setHovered} />
      )}
      {chartType === 'area' && (
        <AreaChart months={months} maxMonthValue={maxMonthValue} hovered={hovered} setHovered={setHovered} />
      )}

      {/* Legend */}
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
  );
}

function BarChart({ months, maxMonthValue, hovered, setHovered }: {
  months: MonthData[]; maxMonthValue: number; hovered: number | null; setHovered: (i: number | null) => void;
}) {
  return (
    <div className="flex items-end justify-between gap-3 h-56">
      {months.map((m, i) => {
        const interestH = (m.interest / maxMonthValue) * 100;
        const capitalH = (m.capital / maxMonthValue) * 100;
        return (
          <div
            key={m.key}
            className="flex flex-1 flex-col items-center gap-2"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="flex w-full flex-col justify-end h-44 gap-0.5">
              <div
                className={`w-full rounded-t-md bg-sky-400 transition-all hover:bg-sky-500 ${hovered === i ? 'opacity-100' : 'opacity-80'}`}
                style={{ height: `${capitalH}%` }}
              />
              <div
                className={`w-full rounded-t-md bg-emerald-500 transition-all hover:bg-emerald-600 ${hovered === i ? 'opacity-100' : 'opacity-80'}`}
                style={{ height: `${interestH}%` }}
              />
            </div>
            <span className={`text-xs transition-colors ${hovered === i ? 'font-bold text-slate-700' : 'text-slate-500'}`}>{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ months, maxMonthValue, hovered, setHovered }: {
  months: MonthData[]; maxMonthValue: number; hovered: number | null; setHovered: (i: number | null) => void;
}) {
  const chartH = 180;
  const chartW = 100;
  const step = chartW / (months.length - 1);

  const interestPoints = months.map((m, i) => `${i * step},${chartH - (m.interest / maxMonthValue) * chartH}`);
  const capitalPoints = months.map((m, i) => `${i * step},${chartH - (m.capital / maxMonthValue) * chartH}`);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-56" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <line key={pct} x1="0" y1={chartH - (pct / 100) * chartH} x2={chartW} y2={chartH - (pct / 100) * chartH} stroke="#f1f5f9" strokeWidth="0.3" />
        ))}
        {/* Capital line */}
        <polyline
          points={capitalPoints.join(' ')}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="0.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Interest line */}
        <polyline
          points={interestPoints.join(' ')}
          fill="none"
          stroke="#10b981"
          strokeWidth="0.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Dots */}
        {months.map((m, i) => (
          <g key={m.key}>
            <circle cx={i * step} cy={chartH - (m.interest / maxMonthValue) * chartH} r={hovered === i ? 1.5 : 0.8} fill="#10b981" />
            <circle cx={i * step} cy={chartH - (m.capital / maxMonthValue) * chartH} r={hovered === i ? 1.5 : 0.8} fill="#0ea5e9" />
          </g>
        ))}
      </svg>
      {/* X-axis labels */}
      <div className="mt-2 flex justify-between px-1">
        {months.map((m, i) => (
          <span
            key={m.key}
            className={`text-xs transition-colors cursor-default ${hovered === i ? 'font-bold text-slate-700' : 'text-slate-500'}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function AreaChart({ months, maxMonthValue, hovered, setHovered }: {
  months: MonthData[]; maxMonthValue: number; hovered: number | null; setHovered: (i: number | null) => void;
}) {
  const chartH = 180;
  const chartW = 100;
  const step = chartW / (months.length - 1);

  const interestPoints = months.map((m, i) => `${i * step},${chartH - (m.interest / maxMonthValue) * chartH}`);
  const capitalPoints = months.map((m, i) => `${i * step},${chartH - (m.capital / maxMonthValue) * chartH}`);
  const interestArea = `0,${chartH} ${interestPoints.join(' ')} ${chartW},${chartH}`;
  const capitalArea = `0,${chartH} ${capitalPoints.join(' ')} ${chartW},${chartH}`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-56" preserveAspectRatio="none">
        {[0, 25, 50, 75, 100].map((pct) => (
          <line key={pct} x1="0" y1={chartH - (pct / 100) * chartH} x2={chartW} y2={chartH - (pct / 100) * chartH} stroke="#f1f5f9" strokeWidth="0.3" />
        ))}
        <polygon points={capitalArea} fill="#0ea5e9" opacity="0.15" />
        <polygon points={interestArea} fill="#10b981" opacity="0.15" />
        <polyline points={capitalPoints.join(' ')} fill="none" stroke="#0ea5e9" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <polyline points={interestPoints.join(' ')} fill="none" stroke="#10b981" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {months.map((m, i) => (
          <g key={m.key}>
            <circle cx={i * step} cy={chartH - (m.interest / maxMonthValue) * chartH} r={hovered === i ? 1.5 : 0.8} fill="#10b981" />
            <circle cx={i * step} cy={chartH - (m.capital / maxMonthValue) * chartH} r={hovered === i ? 1.5 : 0.8} fill="#0ea5e9" />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex justify-between px-1">
        {months.map((m, i) => (
          <span
            key={m.key}
            className={`text-xs transition-colors cursor-default ${hovered === i ? 'font-bold text-slate-700' : 'text-slate-500'}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Distribution Chart (pie, donut, bars) ───

interface DistributionItem { label: string; value: number; color: string; }

function DistributionChartCard({
  title, subtitle, icon, data, defaultChartType, formatAsCurrency,
}: {
  title: string; subtitle: string; icon: React.ReactNode; data: DistributionItem[];
  defaultChartType: ChartType; formatAsCurrency?: boolean;
}) {
  const [chartType, setChartType] = useState<ChartType>(defaultChartType);
  const [hovered, setHovered] = useState<number | null>(null);
  const validTypes: ChartType[] = ['circular', 'donut', 'barras'];
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = (v: number) => formatAsCurrency ? formatCurrency(v) : String(v);

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-teal-600">{icon}</span>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        <ChartTypeSelector value={chartType} onChange={setChartType} types={validTypes} />
      </div>

      {(chartType === 'circular' || chartType === 'donut') && (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          <div className="relative shrink-0">
            <PieChart
              data={data}
              total={total}
              donut={chartType === 'donut'}
              hovered={hovered}
              setHovered={setHovered}
            />
          </div>
          <div className="flex-1 space-y-2.5 w-full">
            {data.map((item, i) => (
              <div
                key={item.label}
                className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors cursor-default ${hovered === i ? 'bg-slate-50' : ''}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-3 w-3 rounded shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-slate-600 truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-slate-900">{fmt(item.value)}</span>
                  <span className="text-xs text-slate-400">{total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {chartType === 'barras' && (
        <div className="space-y-3">
          {data.map((item, i) => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div
                key={item.label}
                className={`rounded-lg px-3 py-2 transition-colors ${hovered === i ? 'bg-slate-50' : ''}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-3 w-3 rounded" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-slate-600">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{fmt(item.value)}</span>
                    <span className="text-xs text-slate-400">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function PieChart({ data, total, donut, hovered, setHovered }: {
  data: DistributionItem[]; total: number; donut: boolean; hovered: number | null; setHovered: (i: number | null) => void;
}) {
  const size = 180;
  const radius = 80;
  const innerRadius = donut ? 48 : 0;
  const center = size / 2;
  const segments: { path: string; color: string; index: number }[] = [];

  if (total > 0) {
    let startAngle = -Math.PI / 2;
    data.forEach((item, i) => {
      if (item.value === 0) return;
      const angle = (item.value / total) * Math.PI * 2;
      const endAngle = startAngle + angle;
      const largeArc = angle > Math.PI ? 1 : 0;

      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);

      let path: string;
      if (donut) {
        const ix1 = center + innerRadius * Math.cos(endAngle);
        const iy1 = center + innerRadius * Math.sin(endAngle);
        const ix2 = center + innerRadius * Math.cos(startAngle);
        const iy2 = center + innerRadius * Math.sin(startAngle);
        path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
      } else {
        path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      }

      segments.push({ path, color: item.color, index: i });
      startAngle = endAngle;
    });
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {total === 0 ? (
        <circle cx={center} cy={center} r={radius} fill="#f1f5f9" />
      ) : (
        segments.map((seg) => (
          <path
            key={seg.index}
            d={seg.path}
            fill={seg.color}
            stroke="#fff"
            strokeWidth={hovered === seg.index ? 2.5 : 1}
            opacity={hovered === null || hovered === seg.index ? 1 : 0.5}
            className="cursor-pointer transition-opacity"
            onMouseEnter={() => setHovered(seg.index)}
            onMouseLeave={() => setHovered(null)}
          />
        ))
      )}
      {donut && total > 0 && (
        <text x={center} y={center - 4} textAnchor="middle" className="fill-slate-400 text-[10px]" style={{ fontSize: '10px' }}>
          Total
        </text>
      )}
      {donut && total > 0 && (
        <text x={center} y={center + 14} textAnchor="middle" className="fill-slate-700 font-bold" style={{ fontSize: '14px', fontWeight: 700 }}>
          {data.length}
        </text>
      )}
    </svg>
  );
}

// ─── Top Clients by Capital ───

function ClientCapitalChartCard({ clients }: { clients: { name: string; count: number; capital: number }[] }) {
  const [chartType, setChartType] = useState<ChartType>('barras');
  const [hovered, setHovered] = useState<number | null>(null);
  const validTypes: ChartType[] = ['barras', 'circular', 'donut'];
  const top = clients.slice(0, 8);
  const total = top.reduce((s, c) => s + c.capital, 0);

  const distribution: DistributionItem[] = top.map((c, i) => ({
    label: c.name,
    value: c.capital,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-teal-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Top clientes por capital</h3>
            <p className="text-xs text-slate-400">Quiénes tienen más plata prestada</p>
          </div>
        </div>
        <ChartTypeSelector value={chartType} onChange={setChartType} types={validTypes} />
      </div>

      {(chartType === 'circular' || chartType === 'donut') && (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
          <PieChart data={distribution} total={total} donut={chartType === 'donut'} hovered={hovered} setHovered={setHovered} />
          <div className="flex-1 space-y-2 w-full">
            {distribution.map((item, i) => (
              <div
                key={item.label}
                className={`flex items-center justify-between rounded-lg px-3 py-1.5 transition-colors ${hovered === i ? 'bg-slate-50' : ''}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-3 w-3 rounded shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-slate-600 truncate">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-slate-900 shrink-0">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {chartType === 'barras' && (
        <div className="space-y-3">
          {top.map((c, i) => {
            const pct = total > 0 ? (c.capital / total) * 100 : 0;
            return (
              <div
                key={c.name}
                className={`rounded-lg px-3 py-2 transition-colors ${hovered === i ? 'bg-slate-50' : ''}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 shrink-0">{i + 1}</span>
                    <span className="text-sm text-slate-600 truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(c.capital)}</span>
                    <span className="text-xs text-slate-400">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
