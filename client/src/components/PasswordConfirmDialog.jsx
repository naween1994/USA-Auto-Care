import React, { useState } from 'react';

export function PasswordConfirmDialog({
  title,
  message,
  actionLabel,
  error,
  isPending,
  onCancel,
  onConfirm,
}) {
  const [password, setPassword] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(password);
        }}
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl"
      >
        <div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{message}</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <div>
          <label htmlFor="confirm-admin-password" className="mb-1 block text-xs font-semibold text-slate-700">
            Your current administrator password
          </label>
          <input
            id="confirm-admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !password}
            className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending ? 'Working...' : actionLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
