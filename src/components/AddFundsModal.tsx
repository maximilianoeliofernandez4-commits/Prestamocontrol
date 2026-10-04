import { useState } from 'react';
import { Modal, MoneyInput, Button, Textarea, Input, Select } from './ui';
import type { Store } from '@/hooks/useStore';
import type { FundMovementType } from '@/types';
import { formatCurrency, todayISO, formatDate } from '@/lib/format';
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  store: Store;
}

export function AddFundsModal({ open, onClose, store }: Props) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<FundMovementType>('aporte');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fundBalance = store.state.funds.reduce(
    (sum, f) => sum + (f.type === 'aporte' ? f.amount : -f.amount),
    0,
  );

  const moveAmount = parseFloat(amount) || 0;
  const canSubmit = moveAmount > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await store.addFund({
        amount: moveAmount,
        type,
        date,
        note: note.trim(),
      });
      setAmount('');
      setNote('');
      setType('aporte');
      setDate(todayISO());
      onClose();
    } catch {
      alert('Error al registrar el movimiento. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Mi Fondo de Capital" size="lg">
      <div className="space-y-5">
        {/* Current balance */}
        <div className="rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 p-5 text-white">
          <div className="flex items-center gap-2">
            <Wallet size={20} />
            <p className="text-sm font-medium text-teal-100">Balance actual de tu fondo</p>
          </div>
          <p className="mt-2 text-3xl font-bold">{formatCurrency(fundBalance)}</p>
          <p className="mt-1 text-xs text-teal-200">Plata disponible para prestar</p>
        </div>

        {/* Movement form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('aporte')}
              className={`flex items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                type === 'aporte'
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <ArrowUpCircle size={22} />
              <div className="text-left">
                <p className="text-sm font-bold">Aporte</p>
                <p className="text-xs opacity-70">Agregar dinero al fondo</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setType('retiro')}
              className={`flex items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                type === 'retiro'
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <ArrowDownCircle size={22} />
              <div className="text-left">
                <p className="text-sm font-bold">Retiro</p>
                <p className="text-xs opacity-70">Sacar dinero del fondo</p>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyInput
              label="Monto ($ ARS) *"
              value={amount}
              onChange={setAmount}
              placeholder="100.000"
              autoFocus
            />
            <Input
              label="Fecha *"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <Textarea
            label="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={type === 'aporte' ? 'Ej: Reinversión de ganancias, depósito bancario...' : 'Ej: Gasto personal, extracción...'}
          />

          {moveAmount > 0 && (
            <div className={`rounded-xl border p-4 ${type === 'aporte' ? 'border-teal-100 bg-teal-50' : 'border-amber-100 bg-amber-50'}`}>
              <p className={`text-sm ${type === 'aporte' ? 'text-teal-700' : 'text-amber-700'}`}>
                {type === 'aporte' ? 'Sumás' : 'Retirás'} <span className="font-bold">{formatCurrency(moveAmount)}</span> de tu fondo.
                Nuevo balance: <span className="font-bold">{formatCurrency(fundBalance + (type === 'aporte' ? moveAmount : -moveAmount))}</span>
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!canSubmit}>
              <Plus size={18} /> Registrar {type === 'aporte' ? 'Aporte' : 'Retiro'}
            </Button>
          </div>
        </form>

        {/* Movement history */}
        {store.state.funds.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-bold text-slate-700">Historial de movimientos</h3>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {store.state.funds.map((fund) => (
                <div key={fund.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      fund.type === 'aporte' ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {fund.type === 'aporte' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${fund.type === 'aporte' ? 'text-teal-700' : 'text-amber-700'}`}>
                        {fund.type === 'aporte' ? '+' : '-'}{formatCurrency(fund.amount)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDate(fund.date)}
                        {fund.note && ` · ${fund.note}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('¿Eliminar este movimiento?')) store.deleteFund(fund.id).catch(() => alert('Error al eliminar.'));
                    }}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
