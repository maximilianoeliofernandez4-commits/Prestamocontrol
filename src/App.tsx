import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/hooks/useStore';
import { Dashboard } from '@/components/Dashboard';
import { Analytics } from '@/components/Analytics';
import { LoanCalculator } from '@/components/LoanCalculator';
import { ClientDetail } from '@/components/ClientDetail';
import { NewClientModal } from '@/components/NewClientModal';
import { EditClientModal } from '@/components/EditClientModal';
import { NewLoanModal } from '@/components/NewLoanModal';
import { PaymentModal } from '@/components/PaymentModal';
import { ReceiptModal } from '@/components/ReceiptModal';
import { AddFundsModal } from '@/components/AddFundsModal';
import { AuthScreen } from '@/components/AuthScreen';
import { AdminPanel } from '@/components/AdminPanel';
import { InvitationsPanel } from '@/components/InvitationsPanel';
import { PublicInvitationForm } from '@/components/PublicInvitationForm';
import { Button } from '@/components/ui';
import type { Client, Loan, Payment } from '@/types';
import { Wallet, Search, Plus, BarChart3, LayoutDashboard, LogOut, Shield, PiggyBank, Calculator, UserPlus } from 'lucide-react';

export default function App() {
  const { session, profile, loading: authLoading, signOut } = useAuth();
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#\/invitar\/([a-f0-9]+)/);
      if (match) {
        setInviteToken(match[1]);
      } else {
        setInviteToken(null);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Public invitation form — no login required
  if (inviteToken) {
    return <PublicInvitationForm token={inviteToken} />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm">
            <Wallet size={24} />
          </div>
          <p className="text-sm text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <MainApp onSignOut={signOut} profileName={profile?.display_name || profile?.email || ''} isAdmin={profile?.role === 'admin'} />;
}

function MainApp({ onSignOut, profileName, isAdmin }: { onSignOut: () => Promise<void>; profileName: string; isAdmin: boolean }) {
  const store = useStore();
  const effectiveIsAdmin = isAdmin || store.isAdmin;
  const [tab, setTab] = useState<'dashboard' | 'analytics' | 'admin' | 'calculator' | 'invitaciones'>('dashboard');
  const [view, setView] = useState<'main' | 'client'>('main');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [showFunds, setShowFunds] = useState(false);
  const [loanForPayment, setLoanForPayment] = useState<Loan | null>(null);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [paymentToEdit, setPaymentToEdit] = useState<Payment | null>(null);
  const [loanClient, setLoanClient] = useState<Client | null>(null);
  const [loanToEdit, setLoanToEdit] = useState<Loan | null>(null);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const selectedClient = store.state.clients.find((c) => c.id === selectedClientId) ?? null;
  const paymentLoan = (loanForPayment ?? (paymentToEdit ? store.state.loans.find((l) => l.id === paymentToEdit.loanId) ?? null : null));
  const paymentClient = paymentLoan ? store.state.clients.find((c) => c.id === paymentLoan.clientId) ?? null : null;
  const lastPaymentLoan = lastPayment ? store.state.loans.find((l) => l.id === lastPayment.loanId) ?? null : null;

  const handleClientClick = (clientId: string) => {
    setSelectedClientId(clientId);
    setView('client');
  };

  const handleNewLoanForClient = (client: Client) => {
    setLoanClient(client);
    setShowNewLoan(true);
  };

  const handleRegisterPayment = (loan: Loan) => {
    setLoanForPayment(loan);
  };

  const handleEditLoan = (loan: Loan) => {
    setLoanToEdit(loan);
  };

  const handlePaymentRegistered = (payment: Payment) => {
    setLastPayment(payment);
  };

  const handleConfirmInvitation = (client: Client) => {
    setLoanClient(client);
    setShowNewLoan(true);
    setTab('dashboard');
  };

  const isClientView = view === 'client' && selectedClient;

  if (store.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm shadow-teal-600/20">
                <Wallet size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-none">PrestaControl</h1>
                <p className="text-[11px] text-slate-400 leading-none mt-0.5">Gestión de préstamos privados</p>
              </div>
            </div>

            {/* Nav tabs - only on main view */}
            {!isClientView && (
              <div className="order-3 flex w-full min-w-0 items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 md:order-none md:w-auto md:max-w-full">
                <button
                  onClick={() => setTab('dashboard')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'dashboard' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <LayoutDashboard size={16} /> Panel
                </button>
                <button
                  onClick={() => setTab('analytics')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'analytics' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <BarChart3 size={16} /> Reportes
                </button>
                <button
                  onClick={() => setTab('calculator')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'calculator' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Calculator size={16} /> Calculadora
                </button>
                <button
                  onClick={() => setTab('invitaciones')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'invitaciones' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <UserPlus size={16} /> Solicitudes
                </button>
                {effectiveIsAdmin && (
                  <button
                    onClick={() => setTab('admin')}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      tab === 'admin' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Shield size={16} /> Admin
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              {effectiveIsAdmin && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                  <Shield size={14} /> Admin
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowFunds(true)}>
                <PiggyBank size={16} /> <span className="hidden sm:inline">Mi Fondo</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowNewClient(true)}>
                <Plus size={16} /> <span className="hidden sm:inline">Cliente</span>
              </Button>
              <Button size="sm" onClick={() => { setLoanClient(null); setShowNewLoan(true); }}>
                <Plus size={16} /> <span className="hidden sm:inline">Préstamo</span>
              </Button>
              <button
                onClick={onSignOut}
                title="Cerrar sesión"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {/* Search bar - only on dashboard tab */}
          {tab === 'dashboard' && !isClientView && (
            <div className="pb-3">
              <div className="relative max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o teléfono..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/15"
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        {isClientView ? (
          <ClientDetail
            store={store}
            client={selectedClient}
            onBack={() => { setView('main'); setSelectedClientId(null); }}
            onNewLoan={handleNewLoanForClient}
            onEditLoan={handleEditLoan}
            onEditClient={(c) => setClientToEdit(c)}
            onRegisterPayment={handleRegisterPayment}
            onViewReceipt={(p) => setLastPayment(p)}
            onEditPayment={(p) => setPaymentToEdit(p)}
          />
        ) : tab === 'dashboard' ? (
          <Dashboard
            store={store}
            search={search}
            onClientClick={handleClientClick}
            onNewClient={() => setShowNewClient(true)}
            onNewLoan={() => { setLoanClient(null); setShowNewLoan(true); }}
          />
        ) : tab === 'invitaciones' ? (
          <InvitationsPanel store={store} onConfirmAndCreateLoan={handleConfirmInvitation} />
        ) : tab === 'admin' && effectiveIsAdmin ? (
          <AdminPanel store={store} />
        ) : tab === 'calculator' ? (
          <LoanCalculator />
        ) : (
          <Analytics store={store} />
        )}
      </main>

      {/* Modals */}
      <AddFundsModal open={showFunds} onClose={() => setShowFunds(false)} store={store} />
      <NewClientModal open={showNewClient} onClose={() => setShowNewClient(false)} store={store} />
      <EditClientModal open={!!clientToEdit} onClose={() => setClientToEdit(null)} store={store} client={clientToEdit} />
      <NewLoanModal open={showNewLoan} onClose={() => setShowNewLoan(false)} store={store} client={loanClient} fixedClient={!!loanClient} />
      <NewLoanModal
        open={!!loanToEdit}
        onClose={() => setLoanToEdit(null)}
        store={store}
        client={loanToEdit ? store.state.clients.find((c) => c.id === loanToEdit.clientId) ?? null : null}
        fixedClient
        loan={loanToEdit}
      />
      <PaymentModal
        open={!!loanForPayment || !!paymentToEdit}
        onClose={() => { setLoanForPayment(null); setPaymentToEdit(null); }}
        store={store}
        loan={paymentLoan}
        client={paymentClient}
        payment={paymentToEdit}
        onPaymentRegistered={handlePaymentRegistered}
      />
      <ReceiptModal
        open={!!lastPayment}
        onClose={() => setLastPayment(null)}
        payment={lastPayment}
        client={lastPayment ? store.state.clients.find((c) => c.id === lastPaymentLoan?.clientId) ?? null : null}
        loan={lastPaymentLoan}
      />
    </div>
  );
}
