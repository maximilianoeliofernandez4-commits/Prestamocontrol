import type { AppState, Client, Loan, Payment } from '@/types';
import { uid, todayISO, addMonthsISO, addWeeksISO, addDaysISO } from './format';

const STORAGE_KEY = 'prestamos_app_v4';

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      for (const l of parsed.loans) {
        if (!l.frequency) l.frequency = 'mensual';
        if (l.termLength === undefined) {
          if (l.frequency === 'semanal') {
            l.termLength = Math.round((l as unknown as { termMonths: number }).termMonths * 4);
          } else if (l.frequency === 'diario') {
            l.termLength = Math.round((l as unknown as { termMonths: number }).termMonths * 30);
          } else {
            l.termLength = (l as unknown as { termMonths: number }).termMonths;
          }
        }
      }
      return parsed;
    }
    // Try migrating from old key
    const oldRaw = localStorage.getItem('prestamos_app_v3');
    if (oldRaw) {
      const parsed = JSON.parse(oldRaw) as AppState;
      for (const l of parsed.loans) {
        if (l.termLength === undefined && (l as unknown as { termMonths: number }).termMonths !== undefined) {
          if (l.frequency === 'semanal') l.termLength = Math.round((l as unknown as { termMonths: number }).termMonths * 4);
          else if (l.frequency === 'diario') l.termLength = Math.round((l as unknown as { termMonths: number }).termMonths * 30);
          else l.termLength = (l as unknown as { termMonths: number }).termMonths;
        }
      }
      saveState(parsed);
      return parsed;
    }
  } catch {
    // ignore
  }
  const seeded = seedData();
  saveState(seeded);
  return seeded;
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedData(): AppState {
  const c1: Client = {
    id: uid(),
    name: 'María González',
    phone: '1134567890',
    notes: 'Cliente frecuente, paga puntual.',
    createdAt: todayISO(),
  };
  const c2: Client = {
    id: uid(),
    name: 'Carlos Ramírez',
    phone: '1155667788',
    notes: 'Negociación flexible, pagos variables.',
    createdAt: todayISO(),
  };
  const c3: Client = {
    id: uid(),
    name: 'Ana Torres',
    phone: '1166778899',
    notes: 'Préstamo con cuota fija a 6 meses.',
    createdAt: todayISO(),
  };
  const c4: Client = {
    id: uid(),
    name: 'Jorge Mendoza',
    phone: '1177889900',
    notes: 'Pagos semanales, comerciante.',
    createdAt: todayISO(),
  };
  const c5: Client = {
    id: uid(),
    name: 'Luz Marina Pérez',
    phone: '1188990011',
    notes: 'Pagos diarios, préstamo corto.',
    createdAt: todayISO(),
  };

  const l1: Loan = {
    id: uid(),
    clientId: c1.id,
    capital: 400000,
    startDate: addMonthsISO(todayISO(), -3),
    interestRate: 15,
    modality: 'solo_interes',
    frequency: 'mensual',
    termLength: 6,
    paymentMethod: 'efectivo',
    status: 'activa',
    createdAt: addMonthsISO(todayISO(), -3),
    note: 'Solo interés mensual, capital cuando cancele.',
  };
  const l2: Loan = {
    id: uid(),
    clientId: c2.id,
    capital: 250000,
    startDate: addMonthsISO(todayISO(), -2),
    interestRate: 20,
    modality: 'personalizado',
    frequency: 'mensual',
    termLength: 5,
    paymentMethod: 'transferencia',
    status: 'activa',
    createdAt: addMonthsISO(todayISO(), -2),
    note: 'Plan personalizado, cuotas flexibles.',
  };
  const l3: Loan = {
    id: uid(),
    clientId: c3.id,
    capital: 600000,
    startDate: addMonthsISO(todayISO(), -2),
    interestRate: 10,
    modality: 'cuota_fija',
    frequency: 'mensual',
    termLength: 6,
    paymentMethod: 'efectivo',
    status: 'activa',
    createdAt: addMonthsISO(todayISO(), -2),
    note: 'Amortización tradicional.',
  };
  const l4: Loan = {
    id: uid(),
    clientId: c4.id,
    capital: 150000,
    startDate: addWeeksISO(todayISO(), -4),
    interestRate: 20,
    modality: 'solo_interes',
    frequency: 'semanal',
    termLength: 8,
    paymentMethod: 'efectivo',
    status: 'activa',
    createdAt: addWeeksISO(todayISO(), -4),
    note: 'Pagos semanales (~2 meses), interés cada semana.',
  };
  const l5: Loan = {
    id: uid(),
    clientId: c5.id,
    capital: 100000,
    startDate: addDaysISO(todayISO(), -10),
    interestRate: 30,
    modality: 'solo_interes',
    frequency: 'diario',
    termLength: 30,
    paymentMethod: 'efectivo',
    status: 'activa',
    createdAt: addDaysISO(todayISO(), -10),
    note: 'Pagos diarios por 30 días (~1 mes), interés diario.',
  };

  const payments: Payment[] = [];

  // María: 3 months of interest payments (15% of 400k = 60k each)
  for (let i = 1; i <= 3; i++) {
    payments.push({
      id: uid(),
      loanId: l1.id,
      date: addMonthsISO(l1.startDate, i),
      amount: 60000,
      method: 'efectivo',
      concept: 'interes',
      imputation: 'interes',
      toInterest: 60000,
      toCapital: 0,
      note: `Interés mes ${i}`,
      receiptNo: `R-${String(i).padStart(5, '0')}`,
      remainingCapital: 400000,
      remainingInterest: 0,
    });
  }

  // Carlos: 1 full payment + 1 partial (solo interés) — 20% of 250k = 50k
  payments.push({
    id: uid(),
    loanId: l2.id,
    date: addMonthsISO(l2.startDate, 1),
    amount: 50000,
    method: 'transferencia',
    concept: 'interes',
    imputation: 'interes',
    toInterest: 50000,
    toCapital: 0,
    note: 'Solo interés mes 1',
    receiptNo: 'R-00004',
    remainingCapital: 250000,
    remainingInterest: 0,
  });
  payments.push({
    id: uid(),
    loanId: l2.id,
    date: addMonthsISO(l2.startDate, 2),
    amount: 30000,
    method: 'efectivo',
    concept: 'interes',
    imputation: 'interes',
    toInterest: 30000,
    toCapital: 0,
    note: 'Pago parcial - solo interés mes 2',
    receiptNo: 'R-00005',
    remainingCapital: 250000,
    remainingInterest: 0,
  });

  // Ana: 2 cuota fija payments — 10% monthly, 600k, 6 months
  const anaMonthly = (600000 * 0.10) / (1 - Math.pow(1.10, -6));
  for (let i = 1; i <= 2; i++) {
    const interest = 600000 * 0.10 * Math.pow(1.10, -(i - 1));
    const cap = anaMonthly - interest;
    payments.push({
      id: uid(),
      loanId: l3.id,
      date: addMonthsISO(l3.startDate, i),
      amount: Math.round(anaMonthly),
      method: 'efectivo',
      concept: 'cuota',
      imputation: 'auto',
      toInterest: Math.round(interest),
      toCapital: Math.round(cap),
      note: `Cuota ${i} de 6`,
      receiptNo: `R-${String(5 + i).padStart(5, '0')}`,
      remainingCapital: Math.round(600000 - cap * i),
      remainingInterest: 0,
    });
  }

  // Jorge: 4 weekly interest payments — 20% of 150k / 4 = 7500
  const weeklyInterest = (150000 * 0.20) / 4;
  for (let i = 1; i <= 4; i++) {
    payments.push({
      id: uid(),
      loanId: l4.id,
      date: addWeeksISO(l4.startDate, i),
      amount: Math.round(weeklyInterest / 100) * 100,
      method: 'efectivo',
      concept: 'interes',
      imputation: 'interes',
      toInterest: Math.round(weeklyInterest / 100) * 100,
      toCapital: 0,
      note: `Interés semana ${i}`,
      receiptNo: `R-${String(7 + i).padStart(5, '0')}`,
      remainingCapital: 150000,
      remainingInterest: 0,
    });
  }

  // Luz Marina: 10 daily interest payments — 30% of 100k / 30 = 1000
  const dailyInterest = (100000 * 0.30) / 30;
  for (let i = 1; i <= 10; i++) {
    payments.push({
      id: uid(),
      loanId: l5.id,
      date: addDaysISO(l5.startDate, i),
      amount: Math.round(dailyInterest / 100) * 100,
      method: 'efectivo',
      concept: 'interes',
      imputation: 'interes',
      toInterest: Math.round(dailyInterest / 100) * 100,
      toCapital: 0,
      note: `Interés día ${i}`,
      receiptNo: `R-${String(11 + i).padStart(5, '0')}`,
      remainingCapital: 100000,
      remainingInterest: 0,
    });
  }

  return {
    clients: [c1, c2, c3, c4, c5],
    loans: [l1, l2, l3, l4, l5],
    payments,
    receiptCounter: 21,
  };
}
