import { useState } from 'react';
import { Modal, Button, Badge, EmptyState } from './ui';
import type { Store } from '@/hooks/useStore';
import type { ClientInvitation, Client } from '@/types';
import { Link2, Copy, Check, UserPlus, Clock, CheckCircle2, XCircle, Eye, Trash2, UserCheck } from 'lucide-react';

interface Props {
  store: Store;
  onConfirmAndCreateLoan: (client: Client) => void;
}

export function InvitationsPanel({ store, onConfirmAndCreateLoan }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [reviewInv, setReviewInv] = useState<ClientInvitation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pending = store.invitations.filter((i) => i.status === 'pendiente');
  const completed = store.invitations.filter((i) => i.status === 'completado');
  const confirmed = store.invitations.filter((i) => i.status === 'confirmado');
  const expired = store.invitations.filter((i) => i.status === 'vencido');

  const handleCreate = async () => {
    setCreating(true);
    try {
      await store.createInvitation(note.trim() || undefined);
      setNote('');
      setShowCreate(false);
    } catch {
      alert('Error al crear el enlace. Intentá de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (inv: ClientInvitation) => {
    const link = `${window.location.origin}${window.location.pathname}#/invitar/${inv.token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleConfirm = async (inv: ClientInvitation) => {
    try {
      const client = await store.confirmInvitation(inv.id);
      if (client) {
        setReviewInv(null);
        onConfirmAndCreateLoan(client);
      }
    } catch {
      alert('Error al confirmar la solicitud.');
    }
  };

  const handleCancel = async (inv: ClientInvitation) => {
    if (confirm('¿Cancelar este enlace? La persona no podrá completar el formulario.')) {
      try {
        await store.cancelInvitation(inv.id);
      } catch {
        alert('Error al cancelar.');
      }
    }
  };

  const statusBadge = (status: ClientInvitation['status']) => {
    switch (status) {
      case 'pendiente': return <Badge variant="warning"><Clock size={12} /> Pendiente</Badge>;
      case 'completado': return <Badge variant="info"><UserCheck size={12} /> Para revisar</Badge>;
      case 'confirmado': return <Badge variant="success"><CheckCircle2 size={12} /> Confirmado</Badge>;
      case 'vencido': return <Badge variant="neutral"><XCircle size={12} /> Vencido</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Solicitudes de Clientes</h2>
          <p className="text-sm text-slate-500">Generá enlaces para que tus clientes se registren solos</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Link2 size={18} /> Nuevo enlace
        </Button>
      </div>

      {/* Pending review — most important */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Para revisar ({completed.length})</h3>
          {completed.map((inv) => (
            <div key={inv.id} className="flex items-center gap-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200">
                {inv.prospectPhotoUrl ? (
                  <img src={inv.prospectPhotoUrl} alt={inv.prospectName} className="h-full w-full object-cover" />
                ) : (
                  <UserPlus size={20} className="text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{inv.prospectName}</p>
                <p className="text-sm text-slate-500">DNI: {inv.prospectDni} · {inv.prospectPhone}</p>
                <p className="text-xs text-slate-400">{inv.prospectAddress}</p>
              </div>
              <Button size="sm" onClick={() => setReviewInv(inv)}>
                <Eye size={15} /> Revisar
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Enlaces pendientes ({pending.length})</h3>
          {pending.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <Link2 size={18} className="shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700">
                  Enlace creado{inv.lenderNote ? ` · ${inv.lenderNote}` : ''}
                </p>
                <p className="text-xs text-slate-400">Esperando que el cliente complete el formulario</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyLink(inv)}>
                {copiedId === inv.id ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
              </Button>
              <button
                onClick={() => handleCancel(inv)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                title="Cancelar enlace"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirmed */}
      {confirmed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Confirmados ({confirmed.length})</h3>
          {confirmed.slice(0, 10).map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 opacity-75">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700">{inv.prospectName}</p>
                <p className="text-xs text-slate-400">DNI: {inv.prospectDni} · {inv.prospectPhone}</p>
              </div>
              {statusBadge(inv.status)}
            </div>
          ))}
        </div>
      )}

      {/* Expired */}
      {expired.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Vencidos ({expired.length})</h3>
          {expired.slice(0, 5).map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 opacity-60">
              <XCircle size={18} className="shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700">{inv.prospectName || 'Enlace cancelado'}</p>
              </div>
              {statusBadge(inv.status)}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {store.invitations.length === 0 && (
        <EmptyState
          icon={<Link2 size={24} />}
          title="Sin solicitudes"
          description="Creá un enlace y envíaselo a tu cliente. Cuando lo complete, vas a ver sus datos acá para confirmar."
          action={<Button onClick={() => setShowCreate(true)}><Link2 size={18} /> Crear primer enlace</Button>}
        />
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo enlace de registro">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Se va a generar un enlace único. Envíaselo por WhatsApp a la persona que querés que sea tu cliente.
            Ella va a completar sus datos (nombre, teléfono, DNI, dirección y foto) y vas a recibir una
            notificación para confirmar.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nota interna (opcional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Cliente recomendado por..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Generando...' : 'Generar enlace'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Review modal */}
      <ReviewModal
        inv={reviewInv}
        onClose={() => setReviewInv(null)}
        onConfirm={handleConfirm}
        onReject={handleCancel}
      />
    </div>
  );
}

function ReviewModal({
  inv, onClose, onConfirm, onReject,
}: {
  inv: ClientInvitation | null;
  onClose: () => void;
  onConfirm: (inv: ClientInvitation) => void;
  onReject: (inv: ClientInvitation) => void;
}) {
  if (!inv) return null;

  return (
    <Modal open={!!inv} onClose={onClose} title="Revisar solicitud" size="lg">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {inv.prospectPhotoUrl ? (
              <img src={inv.prospectPhotoUrl} alt={inv.prospectName} className="h-full w-full object-cover" />
            ) : (
              <UserPlus size={32} className="text-slate-400" />
            )}
          </div>
          <div className="flex-1 space-y-2.5">
            <ReviewField label="Nombre" value={inv.prospectName} />
            <ReviewField label="Teléfono" value={inv.prospectPhone} />
            <ReviewField label="DNI" value={inv.prospectDni} />
            <ReviewField label="Dirección" value={inv.prospectAddress} />
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-700">
            Si confirmás, esta persona se va a agregar automáticamente a tus clientes y vas a poder crearle
            un préstamo al instante. Verificá que la foto coincida con el DNI antes de confirmar.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onReject(inv)}>
            <XCircle size={16} /> Rechazar
          </Button>
          <Button onClick={() => onConfirm(inv)}>
            <UserCheck size={16} /> Confirmar y crear préstamo
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
