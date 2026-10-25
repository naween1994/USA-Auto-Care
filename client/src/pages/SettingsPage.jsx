import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, formatDateTimeLK } from '../lib/apiClient.js';

export function SettingsPage() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState(null);
  const { data: settingsRes } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiRequest('/api/admin/settings'),
  });

  const { data: logsRes } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => apiRequest('/api/admin/audit-logs'),
  });

  const [form, setForm] = useState({
    businessName: 'USA Auto Care',
    location: 'Alawwa, Sri Lanka',
    phone: '',
    streetAddress: '',
    taxRegistrationNumber: '',
    establishedYear: '',
    invoiceFooter: '',
    taxEnabled: false,
    taxLabel: 'VAT',
    taxRatePercent: 0,
    defaultLabourRateLkr: 3500,
    serviceCatalog: [],
    __v: 0,
  });

  useEffect(() => {
    if (settingsRes?.data) {
      const s = settingsRes.data;
      setForm({
        businessName: s.businessName || 'USA Auto Care',
        location: s.location || 'Alawwa, Sri Lanka',
        phone: s.phone || '',
        streetAddress: s.streetAddress || '',
        taxRegistrationNumber: s.taxRegistrationNumber || '',
        establishedYear: s.establishedYear || '',
        invoiceFooter: s.invoiceFooter || '',
        taxEnabled: Boolean(s.taxEnabled),
        taxLabel: s.taxLabel || 'VAT',
        taxRatePercent: s.taxRatePercent || 0,
        defaultLabourRateLkr: (s.defaultLabourRateMinor || 350000) / 100,
        serviceCatalog: (s.serviceCatalog || []).map((service) => ({
          name: service.name,
          defaultRateLkr: service.defaultRateMinor / 100,
        })),
        __v: s.__v,
      });
    }
  }, [settingsRes]);

  const saveSettings = useMutation({
    mutationFn: (payload) => apiRequest('/api/admin/settings', { method: 'PUT', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['auditLogs'] });
      setMsg({ type: 'success', text: 'Business settings saved to MongoDB.' });
    },
    onError: (err) => setMsg({ type: 'error', text: err.message }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Business Settings & Immutable Audit Trail</h2>
        <p className="text-sm text-slate-600">
          Configure phone, street address, tax registration number, establishment year, and tax toggle (disabled by default)
        </p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveSettings.mutate({
              ...form,
              serviceCatalog: form.serviceCatalog.map((service) => ({
                name: service.name,
                defaultRateLkr: Number(service.defaultRateLkr),
              })),
            });
          }}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3"
        >
          <h3 className="text-base font-bold text-slate-900">USA Auto Care Configuration</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Business Name</label>
              <input
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number (Configurable)</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Configure workshop phone"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Established Year (Configurable)</label>
              <input
                type="number"
                value={form.establishedYear}
                onChange={(e) => setForm({ ...form, establishedYear: e.target.value })}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Street Address (Configurable)</label>
            <input
              value={form.streetAddress}
              onChange={(e) => setForm({ ...form, streetAddress: e.target.value })}
              placeholder="Configure street address in Alawwa"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tax Registration Number</label>
              <input
                value={form.taxRegistrationNumber}
                onChange={(e) => setForm({ ...form, taxRegistrationNumber: e.target.value })}
                placeholder="Leave blank if not applicable"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Default Hourly Labour (LKR)</label>
              <input
                type="number"
                value={form.defaultLabourRateLkr}
                onChange={(e) => setForm({ ...form, defaultLabourRateLkr: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={form.taxEnabled}
                onChange={(e) => setForm({ ...form, taxEnabled: e.target.checked })}
              />
              Enable Tax on Estimates & Invoices
            </label>
            {form.taxEnabled && (
              <input
                type="number"
                step="0.1"
                value={form.taxRatePercent}
                onChange={(e) => setForm({ ...form, taxRatePercent: Number(e.target.value) })}
                className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                placeholder="Rate %"
              />
            )}
          </div>
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Estimate Service Catalog</h4>
                <p className="text-xs text-slate-500">Set default LKR rates. Staff can override each rate on an estimate.</p>
              </div>
              <button
                type="button"
                onClick={() => setForm({
                  ...form,
                  serviceCatalog: [...form.serviceCatalog, { name: '', defaultRateLkr: 0 }],
                })}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Add Service
              </button>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {form.serviceCatalog.map((service, index) => (
                <div key={`${service.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_120px_auto] gap-2">
                  <input
                    aria-label={`Service ${index + 1} name`}
                    required
                    maxLength={120}
                    value={service.name}
                    onChange={(event) => {
                      const serviceCatalog = [...form.serviceCatalog];
                      serviceCatalog[index] = { ...service, name: event.target.value };
                      setForm({ ...form, serviceCatalog });
                    }}
                    placeholder="Service name"
                    className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    aria-label={`Service ${index + 1} default rate in LKR`}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={service.defaultRateLkr}
                    onChange={(event) => {
                      const serviceCatalog = [...form.serviceCatalog];
                      serviceCatalog[index] = { ...service, defaultRateLkr: event.target.value };
                      setForm({ ...form, serviceCatalog });
                    }}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${service.name || 'service'}`}
                    onClick={() => setForm({
                      ...form,
                      serviceCatalog: form.serviceCatalog.filter((_, serviceIndex) => serviceIndex !== index),
                    })}
                    className="rounded-lg px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={saveSettings.isPending}
            className="w-full py-2 px-4 rounded-lg bg-brandRed-600 text-white font-semibold text-sm"
          >
            {saveSettings.isPending ? 'Saving...' : 'Save Business Settings'}
          </button>
        </form>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-3">System Audit Trail</h3>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 text-xs">
            {(logsRes?.data || []).map((log) => (
              <div key={log._id} className="py-2.5">
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>{log.action}</span>
                  <span className="text-slate-400">{formatDateTimeLK(log.createdAt)}</span>
                </div>
                <p className="text-slate-600">{log.summary}</p>
                <p className="text-slate-400">Actor: {log.performedByName} ({log.performedByRole})</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
