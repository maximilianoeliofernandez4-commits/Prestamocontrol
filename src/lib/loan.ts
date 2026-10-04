import type { Loan, Payment, AmortizationRow, LoanSummary, PaymentFrequency } from '@/types';
import { addPeriodsISO, todayISO } from './format';

const DAYS_PER_MONTH = 30;
const WEEKS_PER_MONTH = 4;

export function periodsPerMonth(frequency: PaymentFrequency): number {
  if (frequency === 'diario') return DAYS_PER_MONTH;
  if (frequency === 'semanal') return WEEKS_PER_MONTH;
  return 1;
}

export function periodRateMonthly(monthlyRatePct: number, frequency: PaymentFrequency): number {
  const monthly = monthlyRatePct / 100;
  return monthly / periodsPerMonth(frequency);
}

export function periodInterest(capital: number, ratePctMonthly: number, frequency: PaymentFrequency): number {
  return capital * periodRateMonthly(ratePctMonthly, frequency);
}

export function monthlyInterest(capital: number, ratePct: number): number {
  return capital * (ratePct / 100);
}

export function totalPeriods(loan: Loan): number {
  return loan.termLength;
}

export function effectiveMonths(loan: { termLength: number; frequency: PaymentFrequency }): number {
  return loan.termLength / periodsPerMonth(loan.frequency);
}

export function fixedPeriodPayment(capital: number, ratePctMonthly: number, termLength: number, frequency: PaymentFrequency): number {
  const totalInterest = capital * (ratePctMonthly / 100) * effectiveMonths({ termLength, frequency });
  return (capital + totalInterest) / termLength;
}

function roundTo1000(value: number): number {
  return Math.ceil(value / 1000) * 1000;
}

export function generateSchedule(loan: Loan): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  const { capital, modality, startDate, termLength } = loan;
  const r = periodRateMonthly(loan.interestRate, loan.frequency);
  const total = totalPeriods(loan);

  if (modality === 'cuota_fija') {
    const periodPayment = fixedPeriodPayment(capital, loan.interestRate, termLength, loan.frequency);
    let balance = capital;
    for (let i = 1; i <= total; i++) {
      const interest = balance * r;
      const cap = Math.min(periodPayment - interest, balance);
      balance = Math.max(0, balance - cap);
      rows.push({
        month: i,
        date: addPeriodsISO(startDate, i, loan.frequency),
        payment: periodPayment,
        interest,
        capital: cap,
        balance,
      });
    }
  } else {
    // solo_interes and personalizado: pay interest each period, capital at the end
    const interest = capital * r;
    for (let i = 1; i <= total; i++) {
      const isLast = i === total;
      rows.push({
        month: i,
        date: addPeriodsISO(startDate, i, loan.frequency),
        payment: isLast ? interest + capital : interest,
        interest,
        capital: isLast ? capital : 0,
        balance: isLast ? 0 : capital,
      });
    }
  }
  return rows;
}

export function computeSummary(loan: Loan, payments: Payment[]): LoanSummary {
  const loanPayments = payments
    .filter((p) => p.loanId === loan.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  let paidInterest = 0;
  let paidCapital = 0;

  for (const p of loanPayments) {
    paidInterest += p.toInterest;
    paidCapital += p.toCapital;
  }

  const remainingCapital = Math.max(0, loan.capital - paidCapital);

  // For solo_interes/personalizado: interest is open-ended, not capped by schedule
  let totalInterestExpected: number;
  let totalExpected: number;

  if (loan.modality === 'solo_interes' || loan.modality === 'personalizado') {
    // Count all periods that have elapsed since the loan start date up to today
    const today = todayISO();
    let elapsedPeriods = 0;
    for (let period = 1; period < 10000; period += 1) {
      const dueDate = addPeriodsISO(loan.startDate, period, loan.frequency);
      if (dueDate > today) break;
      elapsedPeriods += 1;
    }
    const perPeriodInt = periodInterest(loan.capital, loan.interestRate, loan.frequency);
    totalInterestExpected = Math.max(elapsedPeriods * perPeriodInt, paidInterest + perPeriodInt);
    totalExpected = loan.capital + totalInterestExpected;
  } else {
    const schedule = generateSchedule(loan);
    totalInterestExpected = schedule.reduce((s, r) => s + r.interest, 0);
    totalExpected = loan.capital + totalInterestExpected;
  }

  const totalPaid = loanPayments.reduce((s, p) => s + p.amount, 0);
  const outstandingInterest = Math.max(0, totalInterestExpected - paidInterest);
  const isSettled = remainingCapital < 1 && loanPayments.some((p) => p.toCapital > 0) && paidCapital >= loan.capital - 1;

  return {
    schedule: generateSchedule(loan),
    paidInterest,
    paidCapital,
    remainingCapital,
    remainingInterest: outstandingInterest,
    totalExpected,
    totalPaid,
    progressPct: totalExpected > 0 ? Math.min(100, (totalPaid / totalExpected) * 100) : 0,
    isSettled,
    paymentCount: loanPayments.length,
  };
}

export interface OverduePeriod {
  period: number;
  dueDate: string;
  amount: number;
}

export function overdueBreakdown(loan: Loan, payments: Payment[], today: string): OverduePeriod[] {
  const loanPayments = payments.filter((p) => p.loanId === loan.id && p.date <= today);

  if (loan.modality === 'solo_interes' || loan.modality === 'personalizado') {
    const fixedInterest = roundTo1000(periodInterest(loan.capital, loan.interestRate, loan.frequency));
    const paidInterest = loanPayments.reduce((sum, payment) => sum + payment.toInterest, 0);
    let remainingCredit = paidInterest;
    const result: OverduePeriod[] = [];

    for (let period = 1; period < 10000; period += 1) {
      const dueDate = addPeriodsISO(loan.startDate, period, loan.frequency);
      if (dueDate > today) break;
      const applied = Math.min(fixedInterest, Math.max(0, remainingCredit));
      remainingCredit -= applied;
      const owed = fixedInterest - applied;
      if (owed > 0) {
        result.push({ period, dueDate, amount: owed >= fixedInterest ? fixedInterest : roundTo1000(owed) });
      }
    }
    return result;
  }

  const schedule = generateSchedule(loan);
  const dueRows = schedule.filter((row) => row.date <= today);
  const paidInterest = loanPayments.reduce((sum, p) => sum + p.toInterest, 0);
  const paidCapital = loanPayments.reduce((sum, p) => sum + p.toCapital, 0);
  let interestCredit = paidInterest;
  let capitalCredit = paidCapital;
  const result: OverduePeriod[] = [];

  for (const row of dueRows) {
    const interestApplied = Math.min(row.interest, Math.max(0, interestCredit));
    interestCredit -= interestApplied;
    const capitalApplied = Math.min(row.capital, Math.max(0, capitalCredit));
    capitalCredit -= capitalApplied;
    const interestOwed = row.interest - interestApplied;
    const capitalOwed = row.capital - capitalApplied;
    if (interestOwed > 0 || capitalOwed > 0) {
      result.push({ period: row.month, dueDate: row.date, amount: roundTo1000(interestOwed + capitalOwed) });
    }
  }
  return result;
}

export function overdueDetails(loan: Loan, payments: Payment[], today: string): { amount: number; sinceDate: string } | null {
  const loanPayments = payments.filter((p) => p.loanId === loan.id && p.date <= today);

  if (loan.modality === 'solo_interes' || loan.modality === 'personalizado') {
    const fixedInterest = roundTo1000(periodInterest(loan.capital, loan.interestRate, loan.frequency));
    let periodsDue = 0;
    let firstDueDate = '';

    for (let period = 1; period < 10000; period += 1) {
      const dueDate = addPeriodsISO(loan.startDate, period, loan.frequency);
      if (dueDate > today) break;
      if (!firstDueDate) firstDueDate = dueDate;
      periodsDue += 1;
    }

    const paidInterest = loanPayments.reduce((sum, payment) => sum + payment.toInterest, 0);
    const amount = Math.max(0, periodsDue * fixedInterest - paidInterest);
    return amount > 0 && firstDueDate ? { amount, sinceDate: firstDueDate } : null;
  }

  const breakdown = overdueBreakdown(loan, payments, today);
  if (breakdown.length === 0) return null;
  const amount = breakdown.reduce((sum, p) => sum + p.amount, 0);
  return { amount, sinceDate: breakdown[0].dueDate };
}

export function nextInstallment(loan: Loan, payments: Payment[]): { month: number; amount: number; interest: number; capital: number; date: string } | null {
  const loanPayments = payments.filter((p) => p.loanId === loan.id);
  const paidCount = loanPayments.length;
  const r = periodRateMonthly(loan.interestRate, loan.frequency);
  const paidCapital = loanPayments.reduce((sum, p) => sum + p.toCapital, 0);
  const remainingCapital = Math.max(0, loan.capital - paidCapital);
  const perPeriodInterest = loan.capital * r;

  if (loan.modality === 'solo_interes' || loan.modality === 'personalizado') {
    // Open-ended: next installment is always just the interest for the next period
    // Date is based on last payment date + 1 period, or loan start + 1 period if no payments
    const lastPayment = loanPayments.sort((a, b) => b.date.localeCompare(a.date))[0];
    const baseDate = lastPayment ? lastPayment.date : loan.startDate;
    const nextDate = addPeriodsISO(baseDate, 1, loan.frequency);
    return {
      month: paidCount + 1,
      amount: roundTo1000(perPeriodInterest),
      interest: roundTo1000(perPeriodInterest),
      capital: remainingCapital,
      date: nextDate,
    };
  }

  // cuota_fija: use schedule
  const schedule = generateSchedule(loan);
  const nextIdx = paidCount;
  if (nextIdx >= schedule.length) return null;
  const row = schedule[nextIdx];
  return { month: row.month, amount: roundTo1000(row.payment), interest: roundTo1000(row.interest), capital: roundTo1000(row.capital), date: row.date };
}

export function imputePayment(
  loan: Loan,
  payments: Payment[],
  amount: number,
  imputation: 'auto' | 'interes' | 'capital' | 'mixto',
): { toInterest: number; toCapital: number; concept: 'cuota' | 'interes' | 'capital' | 'mixto' } {
  const summary = computeSummary(loan, payments);
  const { remainingCapital } = summary;
  const next = nextInstallment(loan, payments);

  if (imputation === 'capital') {
    return { toInterest: 0, toCapital: Math.min(amount, remainingCapital), concept: 'capital' };
  }
  if (imputation === 'interes') {
    return { toInterest: amount, toCapital: 0, concept: 'interes' };
  }
  if (imputation === 'mixto') {
    const toInterest = Math.min(amount / 2, amount);
    const toCapital = Math.min(amount - toInterest, remainingCapital);
    return { toInterest, toCapital, concept: 'mixto' };
  }
  // auto
  if (next) {
    const expectedInterest = next.interest;
    const expectedCapital = next.capital;

    // For solo_interes/personalizado, "capital" in next is the full remaining capital
    if (loan.modality === 'solo_interes' || loan.modality === 'personalizado') {
      if (amount >= expectedInterest + remainingCapital) {
        return { toInterest: expectedInterest, toCapital: remainingCapital, concept: 'cuota' };
      }
      if (amount >= expectedInterest) {
        const toCap = Math.min(amount - expectedInterest, remainingCapital);
        return { toInterest: expectedInterest, toCapital: toCap, concept: 'mixto' };
      }
      return { toInterest: amount, toCapital: 0, concept: 'interes' };
    }

    // cuota_fija
    if (amount >= expectedInterest + expectedCapital) {
      return { toInterest: expectedInterest, toCapital: expectedCapital, concept: 'cuota' };
    }
    if (amount >= expectedInterest) {
      const toCap = Math.min(amount - expectedInterest, remainingCapital);
      return { toInterest: expectedInterest, toCapital: toCap, concept: 'mixto' };
    }
    return { toInterest: amount, toCapital: 0, concept: 'interes' };
  }
  return { toInterest: amount, toCapital: 0, concept: 'interes' };
}

const FREQ_LABELS: Record<PaymentFrequency, string> = {
  mensual: 'mensual',
  semanal: 'semanal',
  diario: 'diario',
};

const PERIOD_LABELS: Record<PaymentFrequency, string> = {
  mensual: 'mes',
  semanal: 'semana',
  diario: 'día',
};

const PERIODS_LABELS: Record<PaymentFrequency, string> = {
  mensual: 'meses',
  semanal: 'semanas',
  diario: 'días',
};

export function frequencyLabel(loan: Loan): string {
  return FREQ_LABELS[loan.frequency];
}

export function periodLabel(loan: Loan): string {
  return PERIOD_LABELS[loan.frequency];
}

export function periodsLabel(loan: Loan): string {
  return PERIODS_LABELS[loan.frequency];
}

export function freqBadgeText(frequency: PaymentFrequency): string {
  if (frequency === 'diario') return 'Diario';
  if (frequency === 'semanal') return 'Semanal';
  return 'Mensual';
}
