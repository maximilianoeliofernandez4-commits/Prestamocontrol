import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Camera, CheckCircle2, Loader2, User, Phone, IdCard, MapPin, AlertCircle } from 'lucide-react';

interface Props {
  token: string;
}

interface InvitationData {
  id: string;
  status: string;
  prospect_name: string;
  prospect_phone: string;
  lender_note: string;
}

export function PublicInvitationForm({ token }: Props) {
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dni, setDni] = useState('');
  const [address, setAddress] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const loadInvitation = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('get_invitation_by_token', { p_token: token });
    if (rpcError || !data) {
      setError('El enlace no es válido o ya no está disponible.');
      setLoading(false);
      return;
    }
    setInvitation(data as InvitationData);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('La foto no puede pesar más de 5 MB.');
      return;
    }
    setUploading(true);
    setPhotoPreview(URL.createObjectURL(file));
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${token}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('prospect-photos')
        .upload(path, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage
        .from('prospect-photos')
        .getPublicUrl(path);
      setPhotoUrl(publicData.publicUrl);
    } catch {
      alert('Error al subir la foto. Intentá de nuevo.');
      setPhotoPreview('');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !dni.trim() || !address.trim() || !photoUrl) {
      alert('Por favor completá todos los campos, incluida la foto.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('submit_invitation', {
        p_token: token,
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_dni: dni.trim(),
        p_address: address.trim(),
        p_photo_url: photoUrl,
      });
      if (rpcError) throw rpcError;
      setDone(true);
    } catch {
      alert('Error al enviar tus datos. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-teal-600" />
          <p className="text-sm text-slate-500">Cargando formulario...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
          <AlertCircle size={40} className="mx-auto mb-4 text-rose-500" />
          <h1 className="text-lg font-bold text-slate-900">Enlace no válido</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500" />
          <h1 className="text-lg font-bold text-slate-900">¡Datos enviados!</h1>
          <p className="mt-2 text-sm text-slate-500">
            Tu información fue enviada correctamente. El prestamista se comunicará con vos a la brevedad.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/30 py-8 px-4">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm">
            <User size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Formulario de Registro</h1>
          <p className="mt-1 text-sm text-slate-500">
            Completá tus datos para que el prestamista pueda verificar tu identidad.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
          {/* Photo upload */}
          <div className="flex flex-col items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Foto de tu rostro *</label>
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-50">
                {photoPreview ? (
                  <img src={photoPreview} alt="Foto" className="h-full w-full object-cover" />
                ) : (
                  <Camera size={28} className="text-slate-400" />
                )}
              </div>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                  <Loader2 size={20} className="animate-spin text-teal-600" />
                </div>
              )}
            </div>
            <label className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">
              {photoPreview ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept="image/*" capture="user" onChange={handlePhotoChange} className="hidden" disabled={uploading} />
            </label>
            <p className="text-xs text-slate-400">Tomate una foto clara del rostro, sin gorro ni lentes.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Nombre completo *</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Teléfono / WhatsApp *</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 3001234567"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Número de DNI *</label>
            <div className="relative">
              <IdCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Ej: 30123456"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Dirección actual *</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej: Calle Falsa 123, barrio Centro"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || uploading || !photoUrl}
            className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white transition-all hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 active:scale-[0.98]"
          >
            {submitting ? 'Enviando...' : 'Enviar mis datos'}
          </button>
        </form>
      </div>
    </div>
  );
}
