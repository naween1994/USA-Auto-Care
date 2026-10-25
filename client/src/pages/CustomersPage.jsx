import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, formatLkr } from '../lib/apiClient.js';
import { AdminRecordAction } from '../components/AdminRecordAction.jsx';

export function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
  const [statusMsg, setStatusMsg] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => apiRequest(`/api/customers?search=${encodeURIComponent(search)}`),
  });

  const { data: detailData } = useQuery({
    queryKey: ['customers', 'detail', selectedId],
    queryFn: () => apiRequest(`/api/customers/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => apiRequest('/api/customers', { method: 'POST', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      setForm({ name: '', phone: '', email: '', address: '', notes: '' });
      setStatusMsg({ type: 'success', text: 'Customer saved to MongoDB.' });
    },
    onError: (err) => setStatusMsg({ type: 'error', text: err.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customer Directory</h2>
          <p className="text-sm text-slate-600">Manage customer profiles, multi-vehicle ownership, jobs, and payment history</p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, or email..."
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:w-72"
        />
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-lg text-sm font-medium ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStatusMsg(null);
            createMutation.mutate(form);
          }}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3 h-fit"
        >
          <h3 className="text-base font-bold text-slate-900">Register New Customer</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number *</label>
            <input
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="077-xxxxxxx"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email (Optional)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Address (Optional)</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-2 px-4 rounded-lg bg-brandRed-600 hover:bg-brandRed-700 text-white font-semibold text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Customer'}
          </button>
        </form>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {isLoading ? (
              <div className="p-6 text-sm text-slate-500">Loading customers...</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Address</th>
                    <th className="p-3 text-right">Deposit Credit</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.data || []).map((c) => (
                    <tr key={c._id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold">{c.name}</td>
                      <td className="p-3">{c.phone}</td>
                      <td className="p-3 text-slate-500">{c.address || '—'}</td>
                      <td className="p-3 text-right font-mono">{formatLkr(c.depositBalanceMinor)}</td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedId(c._id)}
                            className="text-xs font-semibold text-brandRed-600 hover:underline"
                          >
                            View Profile
                          </button>
                          <AdminRecordAction recordType="customers" recordId={c._id} recordLabel={`customer ${c.name}`} compact />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {detailData?.data && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                {detailData.data.name} — Vehicles ({detailData.data.vehicles?.length || 0}) & Invoices ({detailData.data.invoices?.length || 0})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <h4 className="font-semibold uppercase text-slate-500 mb-2">Owned Vehicles</h4>
                  <ul className="space-y-1">
                    {(detailData.data.vehicles || []).map((v) => (
                      <li key={v._id} className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="font-mono font-bold">{v.registrationNumber}</span> — {v.make} {v.model} ({v.mileageKm} km)
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold uppercase text-slate-500 mb-2">Invoices & Balances</h4>
                  <ul className="space-y-1">
                    {(detailData.data.invoices || []).map((inv) => (
                      <li key={inv._id} className="p-2 rounded bg-slate-50 border border-slate-200 flex justify-between">
                        <span>{inv.invoiceNumber} ({inv.status})</span>
                        <span className="font-semibold">Due: {formatLkr(inv.balanceDueMinor)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
