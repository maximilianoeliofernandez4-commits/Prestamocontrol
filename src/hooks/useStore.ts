import { useState, useEffect, useCallback } from 'react';
import type { AppState, Client, Loan, Payment, CapitalFund, FundMovementType } from '@/types';
import type { UserProfile } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { migrateLocalDataIfNeeded } from '@/lib/migrate';

const emptyState: AppState = { clients: [], loans: [], payments: [], funds: [], receiptCounter: 0 };

export function useStore() {
  const { session, profile } = useAuth();
  const [state, setState] = useState<AppState>(emptyState);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Load all data from Supabase
  const loadData = useCallback(async () => {
    if (!session?.user?.id) {
      setState(emptyState);
      setLoading(false);
      return;
    }

    // Migrate old localStorage data to Supabase on first login
    try {
      const migrated = await migrateLocalDataIfNeeded();
      if (migrated) {
        // reload profile to pick up admin role after migration
      }
    } catch {
      // ignore migration errors
    }

    // Always fetch profiles to check if current user is admin
    const { data: profilesData } = await supabase.from('profiles').select('id, email, display_name, role, created_at');
    const profilesMap: Record<string, UserProfile> = {};
    for (const p of profilesData ?? []) {
      profilesMap[String(p.id)] = p as UserProfile;
    }
    setProfiles(profilesMap);

    // Determine admin status from multiple sources for reliability
    const currentProfile = profilesMap[session.user.id];
    const adminFromProfile = profile?.role === 'admin';
    const adminFromProfilesMap = currentProfile?.role === 'admin';
    setIsAdmin(adminFromProfile || adminFromProfilesMap);

    const [clientsRes, loansRes, paymentsRes, fundsRes] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: true }),
      supabase.from('loans').select('*').order('created_at', { ascending: true }),
      supabase.from('payments').select('*').order('date', { ascending: true }),
      supabase.from('capital_funds').select('*').order('date', { ascending: false }),
    ]);

    setState({
      clients: (clientsRes.data ?? []).map(mapClient),
      loans: (loansRes.data ?? []).map(mapLoan),
      payments: (paymentsRes.data ?? []).map(mapPayment),
      funds: (fundsRes.data ?? []).map(mapFund),
      receiptCounter: 0,
    });

    setLoading(false);
  }, [session?.user?.id, profile?.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep isAdmin in sync with auth profile — the profile from useAuth
  // may load after the initial loadData run, so update isAdmin here too
  useEffect(() => {
    if (profile?.role === 'admin') {
      setIsAdmin(true);
    }
  }, [profile]);

  const addClient = useCallback(async (data: Omit<Client, 'id' | 'userId' | 'createdAt'>) => {
    const { data: row, error } = await supabase
      .from('clients')
      .insert({ name: data.name, phone: data.phone, notes: data.notes })
      .select()
      .single();
    if (error) throw error;
    const client = mapClient(row);
    setState((s) => ({ ...s, clients: [...s.clients, client] }));
    return client;
  }, []);

  const updateClient = useCallback(async (id: string, data: Partial<Client>) => {
    const { error } = await supabase.from('clients').update({
      name: data.name,
      phone: data.phone,
      notes: data.notes,
    }).eq('id', id);
    if (error) throw error;
    setState((s) => ({
      ...s,
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...data } : c)),
    }));
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    setState((s) => {
      const loanIds = s.loans.filter((l) => l.clientId === id).map((l) => l.id);
      return {
        ...s,
        clients: s.clients.filter((c) => c.id !== id),
        loans: s.loans.filter((l) => l.clientId !== id),
        payments: s.payments.filter((p) => !loanIds.includes(p.loanId)),
      };
    });
  }, []);

  const addLoan = useCallback(async (data: Omit<Loan, 'id' | 'userId' | 'createdAt' | 'status'>) => {
    const { data: row, error } = await supabase
      .from('loans')
      .insert({
        client_id: data.clientId,
        capital: data.capital,
        start_date: data.startDate,
        interest_rate: data.interestRate,
        modality: data.modality,
        frequency: data.frequency,
        term_length: data.termLength,
        payment_method: data.paymentMethod,
        note: data.note,
      })
      .select()
      .single();
    if (error) throw error;
    const loan = mapLoan(row);
    setState((s) => ({ ...s, loans: [...s.loans, loan] }));
    return loan;
  }, []);

  const updateLoan = useCallback(async (id: string, data: Partial<Loan>) => {
    const update: Record<string, unknown> = {};
    if (data.capital !== undefined) update.capital = data.capital;
    if (data.startDate !== undefined) update.start_date = data.startDate;
    if (data.interestRate !== undefined) update.interest_rate = data.interestRate;
    if (data.modality !== undefined) update.modality = data.modality;
    if (data.frequency !== undefined) update.frequency = data.frequency;
    if (data.termLength !== undefined) update.term_length = data.termLength;
    if (data.paymentMethod !== undefined) update.payment_method = data.paymentMethod;
    if (data.status !== undefined) update.status = data.status;
    if (data.note !== undefined) update.note = data.note;
    const { error } = await supabase.from('loans').update(update).eq('id', id);
    if (error) throw error;
    setState((s) => ({
      ...s,
      loans: s.loans.map((l) => (l.id === id ? { ...l, ...data } : l)),
    }));
  }, []);

  const deleteLoan = useCallback(async (id: string) => {
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) throw error;
    setState((s) => ({
      ...s,
      loans: s.loans.filter((l) => l.id !== id),
      payments: s.payments.filter((p) => p.loanId !== id),
    }));
  }, []);

  const addPayment = useCallback(async (data: Omit<Payment, 'id' | 'userId' | 'receiptNo'>) => {
    const counterRes = await supabase
      .from('payments')
      .select('receipt_no', { count: 'exact', head: false });
    const count = counterRes.data?.length ?? 0;
    const receiptNo = `R-${String(count + 1).padStart(5, '0')}`;

    const { data: row, error } = await supabase
      .from('payments')
      .insert({
        loan_id: data.loanId,
        date: data.date,
        amount: data.amount,
        method: data.method,
        concept: data.concept,
        imputation: data.imputation,
        to_interest: data.toInterest,
        to_capital: data.toCapital,
        note: data.note,
        receipt_no: receiptNo,
        remaining_capital: data.remainingCapital,
        remaining_interest: data.remainingInterest,
      })
      .select()
      .single();
    if (error) throw error;
    const payment = mapPayment(row);
    setState((s) => ({ ...s, payments: [...s.payments, payment] }));
    return payment;
  }, []);

  const updatePayment = useCallback(async (id: string, data: Partial<Omit<Payment, 'id' | 'userId' | 'receiptNo'>>) => {
    const update: Record<string, unknown> = {};
    if (data.loanId !== undefined) update.loan_id = data.loanId;
    if (data.date !== undefined) update.date = data.date;
    if (data.amount !== undefined) update.amount = data.amount;
    if (data.method !== undefined) update.method = data.method;
    if (data.concept !== undefined) update.concept = data.concept;
    if (data.imputation !== undefined) update.imputation = data.imputation;
    if (data.toInterest !== undefined) update.to_interest = data.toInterest;
    if (data.toCapital !== undefined) update.to_capital = data.toCapital;
    if (data.note !== undefined) update.note = data.note;
    if (data.remainingCapital !== undefined) update.remaining_capital = data.remainingCapital;
    if (data.remainingInterest !== undefined) update.remaining_interest = data.remainingInterest;

    const { data: row, error } = await supabase.from('payments').update(update).eq('id', id).select().single();
    if (error) throw error;
    const payment = mapPayment(row);
    setState((s) => ({
      ...s,
      payments: s.payments.map((p) => (p.id === id ? payment : p)),
    }));
    return payment;
  }, []);

  const deletePayment = useCallback(async (id: string) => {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) throw error;
    setState((s) => ({
      ...s,
      payments: s.payments.filter((p) => p.id !== id),
    }));
  }, []);

  const getLastPayment = useCallback(
    (loanId: string): Payment | null => {
      const loanPayments = state.payments
        .filter((p) => p.loanId === loanId)
        .sort((a, b) => b.date.localeCompare(a.date));
      return loanPayments[0] || null;
    },
    [state.payments],
  );

  const addFund = useCallback(async (data: { amount: number; type: FundMovementType; date: string; note: string }) => {
    const { data: row, error } = await supabase
      .from('capital_funds')
      .insert({ amount: data.amount, type: data.type, date: data.date, note: data.note })
      .select()
      .single();
    if (error) throw error;
    const fund = mapFund(row);
    setState((s) => ({ ...s, funds: [fund, ...s.funds] }));
    return fund;
  }, []);

  const deleteFund = useCallback(async (id: string) => {
    const { error } = await supabase.from('capital_funds').delete().eq('id', id);
    if (error) throw error;
    setState((s) => ({ ...s, funds: s.funds.filter((f) => f.id !== id) }));
  }, []);

  return {
    state,
    loading,
    isAdmin,
    profiles,
    addClient,
    updateClient,
    deleteClient,
    addLoan,
    updateLoan,
    deleteLoan,
    addPayment,
    updatePayment,
    deletePayment,
    getLastPayment,
    addFund,
    deleteFund,
  };
}

export type Store = ReturnType<typeof useStore>;

function mapClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? ''),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

function mapLoan(row: Record<string, unknown>): Loan {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? ''),
    clientId: String(row.client_id),
    capital: Number(row.capital ?? 0),
    startDate: String(row.start_date ?? ''),
    interestRate: Number(row.interest_rate ?? 0),
    modality: row.modality as Loan['modality'],
    frequency: row.frequency as Loan['frequency'],
    termLength: Number(row.term_length ?? 0),
    paymentMethod: row.payment_method as Loan['paymentMethod'],
    status: (row.status as Loan['status']) ?? 'activa',
    createdAt: String(row.created_at ?? ''),
    note: String(row.note ?? ''),
  };
}

function mapFund(row: Record<string, unknown>): CapitalFund {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? ''),
    amount: Number(row.amount ?? 0),
    type: (row.type as FundMovementType) ?? 'aporte',
    date: String(row.date ?? ''),
    note: String(row.note ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? ''),
    loanId: String(row.loan_id),
    date: String(row.date ?? ''),
    amount: Number(row.amount ?? 0),
    method: row.method as Payment['method'],
    concept: row.concept as Payment['concept'],
    imputation: row.imputation as Payment['imputation'],
    toInterest: Number(row.to_interest ?? 0),
    toCapital: Number(row.to_capital ?? 0),
    note: String(row.note ?? ''),
    receiptNo: String(row.receipt_no ?? ''),
    remainingCapital: Number(row.remaining_capital ?? 0),
    remainingInterest: Number(row.remaining_interest ?? 0),
  };
}
