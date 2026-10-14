import { useState, useEffect } from 'react';
import { Modal, Input, Textarea, Button } from './ui';
import type { Store } from '@/hooks/useStore';
import type { Client } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  store: Store;
  client: Client | null;
}

export function EditClientModal({ open, onClose, store, client }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client && open) {
      setName(client.name);
      setPhone(client.phone);
      setNotes(client.notes);
    }
  }, [client, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !name.trim()) return;
    setSaving(true);
    try {
      await store.updateClient(client.id, {
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
      });
      onClose();
    } catch {
      alert('Error al guardar los cambios. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar Cliente">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nombre completo *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Juan Pérez" autoFocus />
        <Input label="Teléfono / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 3001234567" />
        <Textarea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas internas sobre el cliente" />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cambios'}</Button>
        </div>
      </form>
    </Modal>
  );
}
