import { useState, useMemo } from 'react';
import { Card, Badge, Select, MoneyInput } from './ui';
import { formatCurrency, formatNumber, parseFormattedNumber } from '@/lib/format';
import type { PaymentFrequency } from '@/types';
import { periodsPerMonth } from '@/lib/loan';
import { Calculator, Calendar, DollarSign, Info } from 'lucide-react';

type CalcMode = 'montoFijo' | 'cuotasFijas';
type InterestType = 'saldo' | 'plano' | 'solo_interes';

const INTEREST_OPTIONS: { value: InterestType; label: string; desc: string }[] = [
  { value: 'saldo', label: 'Sobre saldo', desc: 'El interés baja a medida que se paga el capital' },
  { value: 'plano', label: 'Interés plano', desc: 'Interés fijo sobre el capital inicial todos los períodos' },
  { value: 'solo_interes', label: 'Solo interés', desc: 'Paga solo el interés cada período, el capital al final' },
];

export function LoanCalculator() {
  const [mode, setMode] = useState<CalcMode>('montoFijo');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <Calculator size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Calculadora de Préstamos</h1>
          <p className="text-sm text-slate-500">Simulá cuotas y plazos antes de acordar con el cliente</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ModeCard
          active={mode === 'montoFijo'}
          onClick={() => setMode('montoFijo')}
          icon={<DollarSign size={20} />}
          title="Sé el monto, ¿cuántos pagos?"
          desc="Poné el capital, el interés y cuánto paga por período. Te decimos cuántos pagos necesita."
        />
        <ModeCard
          active={mode === 'cuotasFijas'}
          onClick={() => setMode('cuotasFijas')}
          icon={<Calendar size={20} />}
          title="Sé los pagos, ¿cuánto cada uno?"
          desc="Poné el capital, el interés y la cantidad de pagos. Te decimos cuánto tiene que pagar cada uno."
        />
      </div>

      {mode === 'montoFijo' ? <FixedAmountCalc /> : <FixedPaymentsCalc />}
    </div>
  );
}

function ModeCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-2xl border p-4 text-left transition-all ${
        active
          ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'}`}>
        {icon}
      </div>
      <p className={`text-sm font-bold ${active ? 'text-teal-800' : 'text-slate-700'}`}>{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
    </button>
  );
}

const FREQ_OPTIONS: { value: PaymentFrequency; label: string; singular: string; plural: string }[] = [
  { value: 'diario', label: 'Diario', singular: 'día', plural: 'días' },
  { value: 'semanal', label: 'Semanal', singular: 'semana', plural: 'semanas' },
  { value: 'mensual', label: 'Mensual', singular: 'mes', plural: 'meses' },
];

function InterestTypeSelector({ value, onChange }: { value: InterestType; onChange: (v: InterestType) => void }) {
  const current = INTEREST_OPTIONS.find((o) => o.value === value)!;
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">Tipo de interés</span>
      <div className="grid grid-cols-3 gap-2">
        {INTEREST_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
              value === opt.value
                ? 'border-teal-500 bg-teal-50 text-teal-700 ring-1 ring-teal-500/20'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <span className="mt-1 block text-xs text-slate-400">{current.desc}</span>
    </div>
  );
}

function FixedAmountCalc() {
  const [capital, setCapital] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [frequency, setFrequency] = useState<PaymentFrequency>('diario');
  const [interestType, setInterestType] = useState<InterestType>('saldo');

  const freqInfo = FREQ_OPTIONS.find((f) => f.value === frequency)!;

  const result = useMemo(() => {
    const cap = parseFormattedNumber(capital);
    const rate = parseFloat(interestRate) || 0;
    const payment = parseFormattedNumber(paymentAmount);
    if (cap <= 0 || rate <= 0 || payment <= 0) return null;

    const periodsPerMo = periodsPerMonth(frequency);
    const periodRate = rate / 100 / periodsPerMo;
    const flatPeriodInterest = cap * periodRate;

    if (interestType === 'solo_interes') {
      if (payment < flatPeriodInterest) {
        return { type: 'insufficient' as const, periodInterest: roundTo1000(flatPeriodInterest), payment };
      }
      const capitalPerPeriod = payment - flatPeriodInterest;
      if (capitalPerPeriod < 1) {
        return {
          type: 'indefinite' as const,
          paymentPerPeriod: roundTo1000(flatPeriodInterest),
          capital: roundTo1000(cap),
          periodInterest: roundTo1000(flatPeriodInterest),
        };
      }
      const totalPeriods = Math.ceil(cap / capitalPerPeriod);
      const totalInterest = flatPeriodInterest * totalPeriods;
      const totalToPay = cap + totalInterest;
      const effectiveMonths = totalPeriods / periodsPerMo;

      const schedule = buildSchedule(cap, periodRate, payment, interestType, totalPeriods, flatPeriodInterest);
      return {
        type: 'ok' as const,
        totalPeriods,
        totalToPay: roundTo1000(totalToPay),
        totalInterest: roundTo1000(totalInterest),
        effectiveMonths,
        lastPayment: schedule[schedule.length - 1]?.payment ?? roundTo1000(payment),
        periodInterest: roundTo1000(flatPeriodInterest),
        schedule,
      };
    }

    // For 'saldo' and 'plano': first period interest
    const firstInterest = interestType === 'plano' ? flatPeriodInterest : cap * periodRate;

    if (payment <= firstInterest) {
      return { type: 'insufficient' as const, periodInterest: roundTo1000(firstInterest), payment };
    }

    if (interestType === 'plano') {
      // Flat: interest is fixed every period = flatPeriodInterest
      const capitalPerPeriod = payment - flatPeriodInterest;
      const totalPeriods = Math.ceil(cap / capitalPerPeriod);
      const totalInterest = flatPeriodInterest * totalPeriods;
      const totalToPay = cap + totalInterest;
      const effectiveMonths = totalPeriods / periodsPerMo;
      const schedule = buildSchedule(cap, periodRate, payment, interestType, totalPeriods, flatPeriodInterest);
      return {
        type: 'ok' as const,
        totalPeriods,
        totalToPay: roundTo1000(totalToPay),
        totalInterest: roundTo1000(totalInterest),
        effectiveMonths,
        lastPayment: schedule[schedule.length - 1]?.payment ?? roundTo1000(payment),
        periodInterest: roundTo1000(flatPeriodInterest),
        schedule,
      };
    }

    // saldo: interest on remaining balance (declining)
    const capitalPerPeriod = payment - firstInterest;
    const totalPeriods = Math.ceil(cap / capitalPerPeriod);
    const schedule = buildSchedule(cap, periodRate, payment, interestType, totalPeriods, flatPeriodInterest);
    const totalToPay = schedule.reduce((s, r) => s + r.payment, 0);
    const totalInterest = totalToPay - cap;
    const effectiveMonths = totalPeriods / periodsPerMo;

    return {
      type: 'ok' as const,
      totalPeriods,
      totalToPay: roundTo1000(totalToPay),
      totalInterest: roundTo1000(totalInterest),
      effectiveMonths,
      lastPayment: schedule[schedule.length - 1]?.payment ?? roundTo1000(payment),
      periodInterest: roundTo1000(firstInterest),
      schedule,
    };
  }, [capital, interestRate, paymentAmount, frequency, interestType]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="mb-4 text-base font-bold text-slate-900">Datos del préstamo</h2>
        <div className="space-y-4">
          <MoneyInput label="Capital prestado" value={capital} onChange={setCapital} placeholder="1.000.000" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Interés mensual (%)</span>
              <input
                type="text"
                inputMode="decimal"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="10"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </label>
            <Select label="Frecuencia" value={frequency} onChange={(e) => setFrequency(e.target.value as PaymentFrequency)}>
              {FREQ_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>
          <InterestTypeSelector value={interestType} onChange={setInterestType} />
          <MoneyInput
            label={`Monto que paga por ${freqInfo.singular}`}
            hint="Cuánto va a abonar en cada pago"
            value={paymentAmount}
            onChange={setPaymentAmount}
            placeholder="10.000"
          />
        </div>
      </Card>

      <div className="space-y-4">
        {!result ? (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Calculator size={24} />
            </div>
            <p className="text-sm text-slate-400">Completá los datos para ver el resultado</p>
          </Card>
        ) : result.type === 'insufficient' ? (
          <Card className="border-amber-200 bg-amber-50/50 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Info size={20} />
              </div>
              <div>
                <p className="font-bold text-amber-800">El pago no alcanza</p>
                <p className="mt-1 text-sm text-amber-700">
                  El interés por {freqInfo.singular} es <strong>{formatCurrency(result.periodInterest)}</strong>, pero el pago
                  es solo <strong>{formatCurrency(result.payment)}</strong>. Con ese monto nunca termina de pagar el capital.
                  Necesitá un pago mayor al interés {freqInfo.singular}.
                </p>
              </div>
            </div>
          </Card>
        ) : result.type === 'indefinite' ? (
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 bg-teal-50 px-5 py-4">
              <p className="text-xs font-medium text-teal-600">Pago por {freqInfo.singular}</p>
              <p className="text-3xl font-bold text-teal-700">{formatCurrency(result.paymentPerPeriod)}</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <div className="p-4">
                <p className="text-xs text-slate-400">Capital al final</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(result.capital)}</p>
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-400">Duración</p>
                <p className="text-lg font-bold text-slate-700">Indefinida</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                El cliente paga <strong>{formatCurrency(result.periodInterest)}</strong> de interés por {freqInfo.singular}.
                El capital de <strong>{formatCurrency(result.capital)}</strong> se paga cuando el cliente quiera liquidar el préstamo.
              </p>
            </div>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 bg-teal-50 px-5 py-4">
                <p className="text-xs font-medium text-teal-600">Cantidad de pagos necesarios</p>
                <p className="text-3xl font-bold text-teal-700">
                  {result.totalPeriods} <span className="text-lg font-medium">{result.totalPeriods === 1 ? freqInfo.singular : freqInfo.plural}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="p-4">
                  <p className="text-xs text-slate-400">Total a cobrar</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(result.totalToPay)}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs text-slate-400">Ganancia total</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(result.totalInterest)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
                <div className="p-4">
                  <p className="text-xs text-slate-400">Tiempo total</p>
                  <p className="text-sm font-bold text-slate-700">{result.effectiveMonths.toFixed(1)} meses</p>
                </div>
                <div className="p-4">
                  <p className="text-xs text-slate-400">Último pago (ajustado)</p>
                  <p className="text-sm font-bold text-slate-700">{formatCurrency(result.lastPayment)}</p>
                </div>
              </div>
            </Card>

            <ScheduleTable schedule={result.schedule} />
          </>
        )}
      </div>
    </div>
  );
}

function FixedPaymentsCalc() {
  const [capital, setCapital] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termLength, setTermLength] = useState('');
  const [frequency, setFrequency] = useState<PaymentFrequency>('diario');
  const [interestType, setInterestType] = useState<InterestType>('saldo');

  const freqInfo = FREQ_OPTIONS.find((f) => f.value === frequency)!;

  const result = useMemo(() => {
    const cap = parseFormattedNumber(capital);
    const rate = parseFloat(interestRate) || 0;
    if (cap <= 0 || rate <= 0) return null;

    const periodsPerMo = periodsPerMonth(frequency);
    const periodRate = rate / 100 / periodsPerMo;

    if (interestType === 'solo_interes') {
      const flatPeriodInterest = cap * periodRate;
      return {
        type: 'indefinite' as const,
        paymentPerPeriod: roundTo1000(flatPeriodInterest),
        capital: roundTo1000(cap),
        periodInterest: roundTo1000(flatPeriodInterest),
      };
    }

    const periods = parseInt(termLength) || 0;
    if (periods <= 0) return null;
    const effectiveMonths = periods / periodsPerMo;

    if (interestType === 'plano') {
      const flatPeriodInterest = cap * periodRate;
      const totalInterest = flatPeriodInterest * periods;
      const totalToPay = cap + totalInterest;
      const paymentPerPeriod = totalToPay / periods;
      const schedule = buildScheduleFixed(cap, periodRate, interestType, periods, flatPeriodInterest);
      return {
        type: 'ok' as const,
        paymentPerPeriod: roundTo1000(paymentPerPeriod),
        totalToPay: roundTo1000(totalToPay),
        totalInterest: roundTo1000(totalInterest),
        effectiveMonths,
        interestPerPeriod: roundTo1000(flatPeriodInterest),
        capitalPerPeriod: roundTo1000(cap / periods),
        lastPayment: schedule[schedule.length - 1]?.payment ?? roundTo1000(paymentPerPeriod),
        schedule,
      };
    }

    // saldo: interest on declining balance
    const schedule = buildScheduleFixed(cap, periodRate, interestType, periods, 0);
    const totalToPay = schedule.reduce((s, r) => s + r.payment, 0);
    const totalInterest = totalToPay - cap;
    const paymentPerPeriod = totalToPay / periods;
    const firstInterest = schedule[0]?.interest ?? 0;

    return {
      type: 'ok' as const,
      paymentPerPeriod: roundTo1000(paymentPerPeriod),
      totalToPay: roundTo1000(totalToPay),
      totalInterest: roundTo1000(totalInterest),
      effectiveMonths,
      interestPerPeriod: roundTo1000(firstInterest),
      capitalPerPeriod: roundTo1000(cap / periods),
      lastPayment: schedule[schedule.length - 1]?.payment ?? roundTo1000(paymentPerPeriod),
      schedule,
    };
  }, [capital, interestRate, termLength, frequency, interestType]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="mb-4 text-base font-bold text-slate-900">Datos del préstamo</h2>
        <div className="space-y-4">
          <MoneyInput label="Capital prestado" value={capital} onChange={setCapital} placeholder="1.000.000" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Interés mensual (%)</span>
              <input
                type="text"
                inputMode="decimal"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="10"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </label>
            <Select label="Frecuencia" value={frequency} onChange={(e) => setFrequency(e.target.value as PaymentFrequency)}>
              {FREQ_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>
          <InterestTypeSelector value={interestType} onChange={setInterestType} />
          {interestType !== 'solo_interes' && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Cantidad de pagos</span>
              <input
                type="text"
                inputMode="numeric"
                value={termLength ? formatNumber(parseInt(termLength)) : ''}
                onChange={(e) => setTermLength(String(parseFormattedNumber(e.target.value)))}
                placeholder="30"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <span className="mt-1 block text-xs text-slate-400">Equivale a {result && result.type === 'ok' ? result.effectiveMonths.toFixed(1) : '...'} meses</span>
            </label>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        {!result ? (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Calendar size={24} />
            </div>
            <p className="text-sm text-slate-400">Completá los datos para ver el resultado</p>
          </Card>
        ) : result.type === 'indefinite' ? (
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 bg-teal-50 px-5 py-4">
              <p className="text-xs font-medium text-teal-600">Pago por {freqInfo.singular}</p>
              <p className="text-3xl font-bold text-teal-700">{formatCurrency(result.paymentPerPeriod)}</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <div className="p-4">
                <p className="text-xs text-slate-400">Capital al final</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(result.capital)}</p>
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-400">Duración</p>
                <p className="text-lg font-bold text-slate-700">Indefinida</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                El cliente paga <strong>{formatCurrency(result.periodInterest)}</strong> de interés por {freqInfo.singular}.
                El capital de <strong>{formatCurrency(result.capital)}</strong> se paga cuando el cliente quiera liquidar el préstamo.
              </p>
            </div>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 bg-teal-50 px-5 py-4">
                <p className="text-xs font-medium text-teal-600">Pago por {freqInfo.singular}</p>
                <p className="text-3xl font-bold text-teal-700">{formatCurrency(result.paymentPerPeriod)}</p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="p-4">
                  <p className="text-xs text-slate-400">Total a cobrar</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(result.totalToPay)}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs text-slate-400">Ganancia total</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(result.totalInterest)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
                <div className="p-4">
                  <p className="text-xs text-slate-400">Interés del primer pago</p>
                  <p className="text-sm font-bold text-slate-700">{formatCurrency(result.interestPerPeriod)}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs text-slate-400">Último pago (ajustado)</p>
                  <p className="text-sm font-bold text-slate-700">{formatCurrency(result.lastPayment)}</p>
                </div>
              </div>
            </Card>

            <ScheduleTable schedule={result.schedule} />
          </>
        )}
      </div>
    </div>
  );
}

interface ScheduleRow {
  period: number;
  payment: number;
  interest: number;
  capital: number;
  balance: number;
}

function ScheduleTable({ schedule }: { schedule: ScheduleRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3">
        <p className="text-sm font-bold text-slate-700">Plan de pagos</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
              <th className="py-2 px-3 font-medium">#</th>
              <th className="py-2 px-3 font-medium text-right">Pago</th>
              <th className="py-2 px-3 font-medium text-right">Interés</th>
              <th className="py-2 px-3 font-medium text-right">Capital</th>
              <th className="py-2 px-3 font-medium text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {schedule.slice(0, 10).map((row) => (
              <tr key={row.period} className="border-b border-slate-50">
                <td className="py-2 px-3 font-medium text-slate-700">{row.period}</td>
                <td className="py-2 px-3 text-right text-slate-700">{formatCurrency(row.payment)}</td>
                <td className="py-2 px-3 text-right text-slate-500">{formatCurrency(row.interest)}</td>
                <td className="py-2 px-3 text-right text-slate-500">{formatCurrency(row.capital)}</td>
                <td className="py-2 px-3 text-right font-medium text-slate-700">{formatCurrency(row.balance)}</td>
              </tr>
            ))}
            {schedule.length > 10 && (
              <>
                <tr className="border-b border-slate-50">
                  <td colSpan={5} className="py-2 px-3 text-center text-xs text-slate-400">... {schedule.length - 11} pagos más ...</td>
                </tr>
                {schedule.length > 11 && (
                  <tr className="border-b border-slate-50 bg-slate-50/50">
                    <td className="py-2 px-3 font-medium text-slate-700">{schedule[schedule.length - 1].period}</td>
                    <td className="py-2 px-3 text-right text-slate-700">{formatCurrency(schedule[schedule.length - 1].payment)}</td>
                    <td className="py-2 px-3 text-right text-slate-500">{formatCurrency(schedule[schedule.length - 1].interest)}</td>
                    <td className="py-2 px-3 text-right text-slate-500">{formatCurrency(schedule[schedule.length - 1].capital)}</td>
                    <td className="py-2 px-3 text-right font-medium text-slate-700">{formatCurrency(schedule[schedule.length - 1].balance)}</td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function buildSchedule(
  cap: number,
  periodRate: number,
  payment: number,
  interestType: InterestType,
  totalPeriods: number,
  flatPeriodInterest: number,
): ScheduleRow[] {
  const schedule: ScheduleRow[] = [];
  let balance = cap;
  for (let i = 1; i <= totalPeriods; i++) {
    const interest = interestType === 'saldo' ? balance * periodRate : flatPeriodInterest;
    const capPortion = Math.min(payment - interest, balance);
    balance = Math.max(0, balance - capPortion);
    const isLast = i === totalPeriods;
    schedule.push({
      period: i,
      payment: isLast ? roundTo1000(interest + capPortion) : roundTo1000(payment),
      interest: roundTo1000(interest),
      capital: roundTo1000(capPortion),
      balance: roundTo1000(balance),
    });
  }
  return schedule;
}

function buildScheduleFixed(
  cap: number,
  periodRate: number,
  interestType: InterestType,
  totalPeriods: number,
  flatPeriodInterest: number,
): ScheduleRow[] {
  const schedule: ScheduleRow[] = [];
  let balance = cap;
  const capitalPerPeriod = cap / totalPeriods;

  for (let i = 1; i <= totalPeriods; i++) {
    const interest = interestType === 'saldo' ? balance * periodRate : flatPeriodInterest;
    const capPortion = Math.min(capitalPerPeriod, balance);
    balance = Math.max(0, balance - capPortion);
    const isLast = i === totalPeriods;

    if (interestType === 'solo_interes') {
      schedule.push({
        period: i,
        payment: isLast ? roundTo1000(interest + cap) : roundTo1000(interest),
        interest: roundTo1000(interest),
        capital: isLast ? roundTo1000(cap) : 0,
        balance: isLast ? 0 : roundTo1000(balance),
      });
    } else {
      const basePayment = interest + capPortion;
      schedule.push({
        period: i,
        payment: isLast ? roundTo1000(basePayment) : roundTo1000(basePayment),
        interest: roundTo1000(interest),
        capital: roundTo1000(capPortion),
        balance: roundTo1000(balance),
      });
    }
  }
  return schedule;
}

function roundTo1000(value: number): number {
  return Math.ceil(value / 1000) * 1000;
}
