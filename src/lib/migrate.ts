import type { AppState, Client, Loan, Payment } from '@/types';
import { supabase } from '@/lib/supabase';

const OLD_STORAGE_KEY = 'prestamos_app_v4';
const MIGRATION_KEY = 'prestamos_migrated_v1';

interface OldState {
  clients: Client[];
  loans: Loan[];
  payments: Payment[];
  receiptCounter: number;
}

export async function migrateLocalDataIfNeeded(): Promise<boolean> {
  if (localStorage.getItem(MIGRATION_KEY)) return false;

  const raw = localStorage.getItem(OLD_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATION_KEY, '1');
    return false;
  }

  let oldState: OldState;
  try {
    oldState = JSON.parse(raw) as OldState;
  } catch {
    localStorage.setItem(MIGRATION_KEY, '1');
    return false;
  }

  if (!oldState.clients?.length && !oldState.loans?.length && !oldState.payments?.length) {
    localStorage.setItem(MIGRATION_KEY, '1');
    return false;
  }

  const idMap = new Map<string, string>();

  // Migrate clients
  for (const c of oldState.clients) {
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: c.name, phone: c.phone, notes: c.notes })
      .select()
      .single();
    if (error) {
      console.error('Migration error on client', c.name, error.message);
      return false;
    }
    idMap.set(c.id, String(data.id));
  }

  // Migrate loans
  for (const l of oldState.loans) {
    const newClientId = idMap.get(l.clientId);
    if (!newClientId) continue;
    const { data, error } = await supabase
      .from('loans')
      .insert({
        client_id: newClientId,
        capital: l.capital,
        start_date: l.startDate,
        interest_rate: l.interestRate,
        modality: l.modality,
        frequency: l.frequency,
        term_length: l.termLength,
        payment_method: l.paymentMethod,
        status: l.status,
        note: l.note,
      })
      .select()
      .single();
    if (error) {
      console.error('Migration error on loan', error.message);
      return false;
    }
    idMap.set(l.id, String(data.id));
  }

  // Migrate payments
  for (const p of oldState.payments) {
    const newLoanId = idMap.get(p.loanId);
    if (!newLoanId) continue;
    const { error } = await supabase
      .from('payments')
      .insert({
        loan_id: newLoanId,
        date: p.date,
        amount: p.amount,
        method: p.method,
        concept: p.concept,
        imputation: p.imputation,
        to_interest: p.toInterest,
        to_capital: p.toCapital,
        note: p.note,
        receipt_no: p.receiptNo,
        remaining_capital: p.remainingCapital,
        remaining_interest: p.remainingInterest,
      });
    if (error) {
      console.error('Migration error on payment', error.message);
      return false;
    }
  }

  localStorage.setItem(MIGRATION_KEY, '1');
  return true;
}
