import { useState, useEffect } from 'react';
import { Modal, Input, Select, Textarea, Button, MoneyInput } from './ui';
import type { Store } from '@/hooks/useStore';
import type { Client, Loan, LoanModality, PaymentMethod, PaymentFrequency } from '@/types';
import { todayISO, formatCurrency } from '@/lib/format';
import { effectiveMonths, periodsPerMonth } from '@/lib/loan';

interface Props {
  open: boolean;
  onClose: () => void;
  store: Store;
  client: Client | null;
  fixedClient?: boolean;
  loan?: Loan | null;
}

const FREQ_PERIOD_WORD: Record<PaymentFrequency, string> = {
  mensual: 'mes',
  semanal: 'semana',
  diario: 'día',
};

const FREQ_PERIODS_WORD: Record<PaymentFrequency, string> = {
  mensual: 'meses',
  semanal: 'semanas',
  diario: 'días',
};

// Round UP to nearest 1000
function roundUpTo1000(value: number): number {
  return Math.ceil(value / 1000) * 1000;
}

export function NewLoanModal({ open, onClose, store, client, fixedClient, loan }: Props) {
  const [clientId, setClientId] = useState(client?.id ?? loan?.clientId ?? '');
  const [capital, setCapital] = useState(loan ? String(loan.capital) : '');
  const [startDate, setStartDate] = useState(loan?.startDate ?? todayISO());
  const [interestRate, setInterestRate] = useState(loan ? String(loan.interestRate) : '');
  const [modality, setModality] = useState<LoanModality>(loan?.modality ?? 'solo_interes');
  const [frequency, setFrequency] = useState<PaymentFrequency>(loan?.frequency ?? 'mensual');
  const [termLength, setTermLength] = useState(loan ? String(loan.termLength || 6) : '6');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(loan?.paymentMethod ?? 'efectivo');
  const [note, setNote] = useState(loan?.note ?? '');

  useEffect(() => {
    if (open) {
      setClientId(client?.id ?? loan?.clientId ?? '');
      setCapital(loan ? String(loan.capital) : '');
      setStartDate(loan?.startDate ?? todayISO());
      setInterestRate(loan ? String(loan.interestRate) : '');
      setModality(loan?.modality ?? 'solo_interes');
      setFrequency(loan?.frequency ?? 'mensual');
      setTermLength(loan ? String(loan.termLength || 6) : '6');
      setPaymentMethod(loan?.paymentMethod ?? 'efectivo');
      setNote(loan?.note ?? '');
    }
  }, [open, client?.id, loan]);

  const cap = parseFloat(capital) || 0;
  const rate = parseFloat(interestRate) || 0; // always monthly
  const term = parseInt(termLength) || 0;

  const periodWord = FREQ_PERIOD_WORD[frequency];
  const periodsWord = FREQ_PERIODS_WORD[frequency];

  const isOpenEnded = modality === 'solo_interes' || modality === 'personalizado';

  const showPreview = cap > 0 && rate > 0 && (isOpenEnded || term > 0);

  const effMonths = showPreview && !isOpenEnded
    ? effectiveMonths({ interestRate: rate, frequency, termLength: term } as Pick<Loan, 'termLength' | 'frequency'>)
    : 0;

  // Simple interest: total% = monthlyRate% * months
  const totalInterestPct = showPreview && !isOpenEnded ? rate * effMonths : 0;
  const totalToPayRaw = showPreview && !isOpenEnded ? cap * (1 + totalInterestPct / 100) : 0;
  const monthlyInterestAmount = showPreview ? (cap * rate) / 100 : 0;
  const periodsPerMonthVal = showPreview ? periodsPerMonth(frequency) : 1;
  const perPeriodChargeRaw = showPreview
    ? isOpenEnded
      ? frequency === 'mensual'
        ? monthlyInterestAmount
        : monthlyInterestAmount / periodsPerMonthVal
      : totalToPayRaw / term
    : 0;
  const perPeriodCharge = showPreview ? roundUpTo1000(perPeriodChargeRaw) : 0;
  const monthlyEquivalent = monthlyInterestAmount;
  const perPeriodRatePct = showPreview
    ? frequency === 'mensual' ? rate : rate / periodsPerMonthVal
    : 0;

  // Actual totals after rounding up the cuota
  const actualTotal = isOpenEnded ? 0 : perPeriodCharge * term;
  const actualInterestAmount = isOpenEnded ? 0 : Math.max(0, actualTotal - cap);
  const actualInterestPct = cap > 0 && !isOpenEnded ? (actualInterestAmount / cap) * 100 : 0;

  const canSubmit = !!(clientId && cap > 0 && rate > 0 && (isOpenEnded || term > 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      if (loan) {
        await store.updateLoan(loan.id, {
          capital: cap,
          startDate,
          interestRate: rate,
          modality,
          frequency,
          termLength: isOpenEnded ? 0 : term,
          paymentMethod,
          note: note.trim(),
        });
      } else {
        await store.addLoan({
          clientId,
          capital: cap,
          startDate,
          interestRate: rate,
          modality,
          frequency,
          termLength: isOpenEnded ? 0 : term,
          paymentMethod,
          note: note.trim(),
        });
      }
      setCapital('');
      setInterestRate('');
      setNote('');
      setTermLength('6');
      setFrequency('mensual');
      onClose();
    } catch {
      alert('Error al crear el préstamo. Intentá de nuevo.');
    }
  };

  const modalityLabels: Record<LoanModality, string> = {
    cuota_fija: 'Cuota Fija (Capital + Interés)',
    solo_interes: 'Solo Interés (sin plazo fijo)',
    personalizado: 'Personalizado / Flexible',
  };

  return (
    <Modal open={open} onClose={onClose} title={loan ? 'Editar Préstamo' : 'Nuevo Préstamo'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!fixedClient && (
          <Select label="Cliente *" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Seleccionar cliente...</option>
            {store.state.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        )}

        <div className="grid grid-cols-2 gap-4">
          <MoneyInput label="Capital inicial ($ ARS) *" value={capital} onChange={setCapital} placeholder="400.000" />
          <Input
            label="Tasa de interés mensual (%) *"
            type="number"
            step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder="20"
            hint="Siempre mensual — la app calcula el proporcional según la frecuencia"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Fecha de inicio *" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          {!isOpenEnded ? (
            <Input label={`Plazo (${periodsWord}) *`} type="number" value={termLength} onChange={(e) => setTermLength(e.target.value)} placeholder="6" hint={effMonths > 0 ? `Equivale a ${effMonths.toFixed(1)} meses · Interés total: ${totalInterestPct.toFixed(1)}%` : undefined} />
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-2.5">
              <p className="text-sm font-medium text-amber-700">Sin plazo fijo</p>
              <p className="text-xs text-amber-500 mt-0.5">El cliente paga el interés cada {periodWord} hasta que cancele el capital.</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Frecuencia de pago *" value={frequency} onChange={(e) => setFrequency(e.target.value as PaymentFrequency)}>
            <option value="mensual">Mensual (30 días)</option>
            <option value="semanal">Semanal</option>
            <option value="diario">Diario</option>
          </Select>
          <Select label="Modalidad de pago *" value={modality} onChange={(e) => setModality(e.target.value as LoanModality)}>
            {(Object.entries(modalityLabels) as [LoanModality, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>

        <Select label="Método de pago preferido" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
        </Select>

        <Textarea label="Notas del préstamo" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Condiciones especiales, acuerdos, etc." />

        {showPreview && (
          <div className="rounded-xl bg-teal-50 border border-teal-100 p-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">
                  {modality === 'cuota_fija' ? `Cuota ${periodWord}` : frequency === 'mensual' ? 'Interés mensual' : `Cobro ${periodWord}`}
                </p>
                <p className="text-2xl font-bold text-teal-900">{formatCurrency(perPeriodCharge)}</p>
              </div>
              {!isOpenEnded && (
                <div className="text-right">
                  <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">Total a pagar</p>
                  <p className="text-xl font-bold text-teal-900">{formatCurrency(actualTotal)}</p>
                </div>
              )}
            </div>

            <div className={`border-t border-teal-100 pt-3 grid gap-3 text-sm ${isOpenEnded ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <div>
                <p className="text-xs text-teal-500">Capital</p>
                <p className="font-semibold text-teal-800">{formatCurrency(cap)}</p>
              </div>
              {!isOpenEnded ? (
                <div>
                  <p className="text-xs text-teal-500">Interés total</p>
                  <p className="font-semibold text-teal-800">
                    {actualInterestPct.toFixed(1)}%
                    {actualInterestPct > totalInterestPct + 0.01 && (
                      <span className="block text-xs font-normal text-teal-400">redondeado desde {totalInterestPct.toFixed(1)}%</span>
                    )}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-teal-500">Tasa mensual</p>
                  <p className="font-semibold text-teal-800">{rate.toFixed(1)}%</p>
                </div>
              )}
              {!isOpenEnded && (
                <div>
                  <p className="text-xs text-teal-500">Duración</p>
                  <p className="font-semibold text-teal-800">{term} {periodsWord}</p>
                  <p className="text-xs text-teal-400">{effMonths.toFixed(1)} meses</p>
                </div>
              )}
            </div>

            {/* Rate breakdown — always show for non-monthly frequencies */}
            {frequency !== 'mensual' && (
              <div className="border-t border-teal-100 pt-3 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-teal-600">Tasa por {periodWord}</span>
                  <span className="font-semibold text-teal-800">{perPeriodRatePct.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-teal-600">Tasa mensual</span>
                  <span className="font-semibold text-teal-800">{rate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-teal-600">Interés {periodWord}</span>
                  <span className="font-semibold text-teal-800">{formatCurrency(perPeriodCharge)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-teal-600">Interés mensual equivalente</span>
                  <span className="font-bold text-teal-900">{formatCurrency(monthlyEquivalent)}</span>
                </div>
              </div>
            )}

            {isOpenEnded && (
              <p className="text-xs text-teal-600 border-t border-teal-100 pt-2">
                {frequency === 'mensual'
                  ? `${formatCurrency(monthlyInterestAmount)} de interés cada mes (${rate.toFixed(1)}% mensual sobre el capital).`
                  : `${formatCurrency(perPeriodCharge)} de interés cada ${periodWord}.`}{' '}
                El capital se paga cuando el cliente cancele el préstamo, sin límite de tiempo.
              </p>
            )}
            {modality === 'cuota_fija' && (
              <p className="text-xs text-teal-600 border-t border-teal-100 pt-2">
                Cuota fija de {formatCurrency(perPeriodCharge)} cada {periodWord} durante {term} {periodsWord}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!canSubmit}>{loan ? 'Guardar cambios' : 'Crear Préstamo'}</Button>
        </div>
      </form>
    </Modal>
  );
}
