import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, formatLkr, formatDateTimeLK } from '../lib/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

export function InventoryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canSeeCost = ['admin', 'receptionist'].includes(user?.role);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: 'Filters',
    compatibilityNotes: '',
    unit: 'pcs',
    purchaseCostLkr: 1500,
    sellingPriceLkr: 2400,
    quantityOnHand: 10,
    reorderThreshold: 5,
    storageLocation: 'Rack A-1',
  });

  const { data: partsRes } = useQuery({
    queryKey: ['inventory', 'parts'],
    queryFn: () => apiRequest('/api/inventory/parts'),
  });

  const { data: movementsRes } = useQuery({
    queryKey: ['inventory', 'movements'],
    queryFn: () => apiRequest('/api/inventory/movements'),
    enabled: canSeeCost,
  });

  const createPartMutation = useMutation({
    mutationFn: (payload) => apiRequest('/api/inventory/parts', { method: 'POST', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setMsg({ type: 'success', text: 'Part and initial stock movement saved to MongoDB.' });
      setForm({ ...form, sku: '', name: '' });
    },
    onError: (err) => setMsg({ type: 'error', text: err.message }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Parts Inventory, Suppliers & Stock Ledger</h2>
        <p className="text-sm text-slate-600">
          Atomic stock levels, reorder thresholds, and full StockMovement ledger
        </p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canSeeCost && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createPartMutation.mutate(form);
            }}
            className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3 h-fit"
          >
            <h3 className="text-base font-bold text-slate-900">Add Part to Catalogue</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">SKU *</label>
                <input
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="FLT-AIR-123"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Category *</label>
                <input
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Part Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Purchase Cost (LKR)</label>
                <input
                  type="number"
                  required
                  value={form.purchaseCostLkr}
                  onChange={(e) => setForm({ ...form, purchaseCostLkr: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Selling Price (LKR)</label>
                <input
                  type="number"
                  required
                  value={form.sellingPriceLkr}
                  onChange={(e) => setForm({ ...form, sellingPriceLkr: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Opening Stock</label>
                <input
                  type="number"
                  required
                  value={form.quantityOnHand}
                  onChange={(e) => setForm({ ...form, quantityOnHand: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reorder Alert At</label>
                <input
                  type="number"
                  required
                  value={form.reorderThreshold}
                  onChange={(e) => setForm({ ...form, reorderThreshold: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={createPartMutation.isPending}
              className="w-full py-2 px-4 rounded-lg bg-brandRed-600 hover:bg-brandRed-700 text-white font-semibold text-sm"
            >
              {createPartMutation.isPending ? 'Saving...' : 'Save Part'}
            </button>
          </form>
        )}

        <div className={canSeeCost ? 'lg:col-span-2 space-y-6' : 'lg:col-span-3 space-y-6'}>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Part Name</th>
                  {canSeeCost && <th className="p-3 text-right">Purchase Cost</th>}
                  <th className="p-3 text-right">Selling Price</th>
                  <th className="p-3 text-right">On Hand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(partsRes?.data || []).map((p) => (
                  <tr key={p._id}>
                    <td className="p-3 font-mono font-bold text-xs">{p.sku}</td>
                    <td className="p-3">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.category} • {p.storageLocation}</div>
                    </td>
                    {canSeeCost && (
                      <td className="p-3 text-right font-mono text-xs">{formatLkr(p.purchaseCostMinor)}</td>
                    )}
                    <td className="p-3 text-right font-mono text-xs font-semibold">{formatLkr(p.sellingPriceMinor)}</td>
                    <td className="p-3 text-right font-bold">
                      <span className={p.quantityOnHand <= p.reorderThreshold ? 'text-brandRed-600' : 'text-emerald-700'}>
                        {p.quantityOnHand} {p.unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canSeeCost && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-3">Stock Movement Ledger</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500 uppercase">
                    <tr>
                      <th className="py-2">Time</th>
                      <th className="py-2">SKU</th>
                      <th className="py-2">Type</th>
                      <th className="py-2 text-right">Delta</th>
                      <th className="py-2 text-right">Balance After</th>
                      <th className="py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(movementsRes?.data || []).map((m) => (
                      <tr key={m._id}>
                        <td className="py-2">{formatDateTimeLK(m.createdAt)}</td>
                        <td className="py-2 font-mono">{m.part?.sku}</td>
                        <td className="py-2 font-semibold">{m.movementType}</td>
                        <td className="py-2 text-right font-mono">
                          {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                        </td>
                        <td className="py-2 text-right font-mono font-bold">{m.balanceAfter}</td>
                        <td className="py-2 text-slate-600">{m.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
