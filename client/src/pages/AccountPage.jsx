import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { apiRequest } from '../lib/apiClient.js';

export function AccountPage() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState(null);
  const changePassword = useMutation({
    mutationFn: (payload) => apiRequest('/api/auth/change-password', { method: 'POST', body: payload }),
    onSuccess: (response) => {
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: response.message });
    },
    onError: (error) => setMessage({ type: 'error', text: error.message }),
  });

  function submit(event) {
    event.preventDefault();
    setMessage(null);
    if (form.newPassword !== form.confirmPassword) {
      setMessage({ type: 'error', text: 'The new passwords do not match.' });
      return;
    }
    changePassword.mutate({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Account</h2>
        <p className="text-sm text-slate-600">Change the password for your own staff account.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-blue-700" />
          <h3 className="font-bold text-slate-900">Change Password</h3>
        </div>
        {message && (
          <div
            role={message.type === 'error' ? 'alert' : 'status'}
            className={`rounded-lg p-3 text-sm ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}
          >
            {message.text}
          </div>
        )}
        <label className="block text-sm font-medium text-slate-700">
          Current password
          <input
            required
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          New password (at least 8 characters)
          <input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Confirm new password
          <input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={changePassword.isPending}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {changePassword.isPending ? 'Saving...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
