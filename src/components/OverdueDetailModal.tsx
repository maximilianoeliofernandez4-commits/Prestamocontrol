import { useMemo } from 'react';
import { Modal, Card, Badge, Button } from './ui';
import type { Store } from '@/hooks/useStore';
import type { Client } from '@/types';
import { overdueBreakdown, periodLabel, periodsLabel } from '@/lib/loan';
import { formatCurrency, formatDate, todayISO } from '@/lib/format';
import { MessageCircle, AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  store: Store;
  client: Client | null;
}

export function OverdueDetailModal({ open, onClose, store, client }: Props) {
  const details = useMemo(() => {
    if (!client) return [];
    const today = todayISO();
    const result: {
      loanId: string;
      capital: number;
      interestRate: number;
      frequency: 'mensual' | 'semanal' | 'diario';
      modality: 'cuota_fija' | 'solo_interes' | 'personalizado';
      startDate: string;
      periods: { period: number; dueDate: string; amount: number }[];
      total: number;
    }[] = [];

    const clientLoans = store.state.loans.filter(
      (l) => l.clientId === client.id && l.status === 'activa',
    );

    for (const loan of clientLoans) {
      const periods = overdueBreakdown(loan, store.state.payments, today);
      if (periods.length > 0) {
        result.push({
          loanId: loan.id,
          capital: loan.capital,
          interestRate: loan.interestRate,
          frequency: loan.frequency,
          modality: loan.modality,
          startDate: loan.startDate,
          periods,
          total: periods.reduce((s, p) => s + p.amount, 0),
        });
      }
    }
    return result;
  }, [client, store.state]);

  const totalDebt = details.reduce((s, d) => s + d.total, 0);

  const buildWhatsAppMessage = () => {
    if (!client) return '';
    const lines: string[] = [];
    lines.push(`Hola ${client.name}, te recordamos tu situación de pagos atrasados:`);
    lines.push('');

    for (const detail of details) {
      const freqWord = periodsLabel({
        frequency: detail.frequency,
        termLength: detail.periods.length,
      } as never);
      lines.push(
        `*Préstamo de ${formatCurrency(detail.capital)}* (${detail.interestRate}% mensual)`,
      );
      detail.periods.forEach((p) => {
        lines.push(
          `  - ${freqWord === 'meses' ? 'Mes' : freqWord === 'semanas' ? 'Semana' : 'Día'} ${p.period} (venc. ${formatDate(p.dueDate)}): ${formatCurrency(p.amount)}`,
        );
      });
      lines.push(`  Subtotal: ${formatCurrency(detail.total)}`);
      lines.push('');
    }

    lines.push(`*Total adeudado: ${formatCurrency(totalDebt)}*`);
    lines.push('');
    lines.push('Por favor, comunicate para regularizar la situación. Gracias.');
    return lines.join('\n');
  };

  const sendWhatsApp = () => {
    if (!client) return;
    const rawPhone = client.phone.replace(/[^\d]/g, '');
    if (!rawPhone) {
      alert('Este cliente no tiene un número de teléfono registrado.');
      return;
    }
    const message = encodeURIComponent(buildWhatsAppMessage());
    window.open(`https://wa.me/${rawPhone}?text=${message}`, '_blank');
  };

  if (!client) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Deuda de ${client.name}`} size="lg">
      {details.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-500">Este cliente no tiene cuotas atrasadas.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary */}
          <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-100 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="text-sm text-rose-600">Total adeudado</p>
                <p className="text-2xl font-bold text-rose-700">{formatCurrency(totalDebt)}</p>
              </div>
            </div>
            <Badge variant="danger">
              {details.reduce((s, d) => s + d.periods.length, 0)} cuotas atrasadas
            </Badge>
          </div>

          {/* Per-loan breakdown */}
          {details.map((detail) => (
            <Card key={detail.loanId} className="overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800">
                    Préstamo de {formatCurrency(detail.capital)}
                  </p>
                  <span className="text-xs text-slate-500">
                    {detail.interestRate}% mensual · Inicio {formatDate(detail.startDate)}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {detail.periods.map((p) => (
                  <div key={p.period} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-xs font-bold text-rose-600">
                        {p.period}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {periodLabel({ frequency: detail.frequency } as never) === 'mes'
                            ? 'Cuota mensual'
                            : periodLabel({ frequency: detail.frequency } as never) === 'semana'
                              ? 'Cuota semanal'
                              : 'Cuota diaria'}
                        </p>
                        <p className="text-xs text-slate-400">Vencimiento: {formatDate(p.dueDate)}</p>
                      </div>
                    </div>
                    <span className="font-bold text-rose-600 text-sm">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                <span className="text-xs font-medium text-slate-500">Subtotal adeudado</span>
                <span className="font-bold text-rose-600">{formatCurrency(detail.total)}</span>
              </div>
            </Card>
          ))}

          {/* WhatsApp button */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              onClick={sendWhatsApp}
              className="bg-[#25D366] text-white hover:bg-[#1ebe57] focus:ring-[#25D366]"
            >
              <MessageCircle size={18} />
              Enviar por WhatsApp
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
