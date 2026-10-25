import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070a14] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #dc2626 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -left-40 h-[560px] w-[560px] rounded-full opacity-35 blur-3xl"
        style={{ background: 'radial-gradient(circle, #1d4ed8 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <header className="relative z-10 border-b border-slate-800/80 bg-[#0b1120]/80 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-500/30 bg-white p-1.5 shadow-md">
              <img src="/logo.jpeg" alt="USA Auto Care Logo" className="h-9 w-auto object-contain" />
            </div>
            <div>
              <h1 className="font-extrabold tracking-tight text-white">USA AUTO CARE</h1>
              <p className="text-xs text-slate-400">Alawwa, Sri Lanka • Workshop Operations</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-blue-200">
              Vehicle service & repair
            </span>
            <span className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-red-200">
              Staff sign-in
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-145px)] max-w-7xl grid-cols-1 items-center gap-8 px-5 py-10 sm:px-8 lg:grid-cols-12 lg:gap-12">
        <section className="space-y-6 lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-600/15 px-3.5 py-1.5 text-xs font-semibold text-red-200">
            <Wrench className="h-3.5 w-3.5 text-red-400" />
            Workshop management • Alawwa, Sri Lanka
          </div>

          <div className="space-y-4">
            <h2 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
              Keep every repair moving with{' '}
              <span className="bg-gradient-to-r from-blue-400 via-white to-red-400 bg-clip-text text-transparent">
                one workshop workspace.
              </span>
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Manage customer vehicles, appointments, inspections, estimate approvals, workshop stock, and invoices in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                title: 'Vehicle check-in',
                detail: 'Track customer concerns, inspection results, and repair progress.',
                tone: 'border-blue-500/30 text-blue-300',
              },
              {
                title: 'Customer approval',
                detail: 'Record estimate approval before continuing authorized work.',
                tone: 'border-red-500/30 text-red-300',
              },
              {
                title: 'Workshop operations',
                detail: 'Keep job cards, parts, payments, and service history together.',
                tone: 'border-emerald-500/30 text-emerald-300',
              },
            ].map((feature) => (
              <article
                key={feature.title}
                className="rounded-xl border border-slate-800 bg-[#0f172a]/90 p-4 shadow-xl"
              >
                <h3 className={`text-xs font-bold uppercase tracking-wide ${feature.tone.split(' ')[1]}`}>
                  {feature.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{feature.detail}</p>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-slate-800 bg-slate-900/90 p-4 text-xs text-slate-300">
            <span>Hotlines: 0773995399 / 0703995399</span>
            <span>usaautocare66@gmail.com</span>
          </div>
        </section>

        <section className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a]/95 p-6 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-white">Staff Portal</h2>
                <p className="mt-1 text-xs text-slate-400">Sign in with your staff account</p>
              </div>
              <div className="rounded-lg bg-white p-1.5">
                <img src="/logo.jpeg" alt="" className="h-7 w-auto object-contain" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/50 p-3 text-sm text-rose-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Staff Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-blue-500 hover:to-red-500 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? 'Authenticating...' : 'Sign In to Workshop Portal'}
              </button>
            </form>
            <p className="mt-4 border-t border-slate-800 pt-4 text-center text-[11px] text-slate-500">
              Access is managed by your workshop administrator.
            </p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-800/80 bg-[#0b1120]/80 px-5 py-3 text-center text-[11px] text-slate-500 sm:px-8">
        USA Auto Care • Alawwa, Sri Lanka
      </footer>
    </div>
  );
}
