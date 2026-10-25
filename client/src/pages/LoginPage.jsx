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
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-navy-900 p-6 text-white border-b-4 border-brandRed-600">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-xl bg-white shadow">
              <img src="/logo.jpeg" alt="USA Auto Care Logo" className="h-10 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold">USA Auto Care</h1>
              <p className="text-xs text-slate-300">Alawwa, Sri Lanka • 0773995399 / 0703995399 • usaautocare66@gmail.com</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Staff Email Address
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandRed-500"
              placeholder="name@usaautocare.local"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandRed-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg bg-brandRed-600 hover:bg-brandRed-700 disabled:opacity-50 text-white font-semibold text-sm transition"
          >
            {submitting ? 'Authenticating...' : 'Sign In to Workshop Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
