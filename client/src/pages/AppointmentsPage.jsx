import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiRequest, formatDateTimeLK } from '../lib/apiClient.js';

export function AppointmentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    customer: '',
    vehicle: '',
    isWalkIn: false,
    requestedService: '',
    scheduledAt: new Date().toISOString().slice(0, 16),
    notes: '',
  });

  const { data: apptsRes } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => apiRequest('/api/appointments'),
  });

  const { data: customersRes } = useQuery({
    queryKey: ['customers', 'dropdown'],
    queryFn: () => apiRequest('/api/customers?limit=100'),
  });

  const { data: vehiclesRes } = useQuery({
    queryKey: ['vehicles', 'dropdown', form.customer],
    queryFn: () =>
      apiRequest(form.customer ? `/api/vehicles?customerId=${form.customer}` : '/api/vehicles?limit=100'),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => apiRequest('/api/appointments', { method: 'POST', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      setMsg({ type: 'success', text: 'Appointment booked and persisted to MongoDB.' });
      setForm({ ...form, requestedService: '', notes: '' });
    },
    onError: (err) => setMsg({ type: 'error', text: err.message }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, __v }) =>
      apiRequest(`/api/appointments/${id}`, { method: 'PATCH', body: { status, __v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const convertToJobMutation = useMutation({
    mutationFn: (appt) =>
      apiRequest('/api/job-cards', {
        method: 'POST',
        body: {
          appointmentId: appt._id,
          customer: appt.customer?._id,
          vehicle: appt.vehicle?._id,
          mileageInKm: appt.vehicle?.mileageKm || 50000,
          fuelLevel: '1/2',
          customerComplaints: appt.requestedService,
          existingDamageNotes: appt.notes || '',
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['jobCards'] });
      navigate('/job-cards');
    },
    onError: (err) => setMsg({ type: 'error', text: err.message }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Appointments & Walk-In Queue</h2>
        <p className="text-sm text-slate-600">
          Schedule service bookings or walk-ins and convert arrived vehicles directly into Job Cards without re-entry
        </p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            createMutation.mutate(form);
          }}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3 h-fit"
        >
          <h3 className="text-base font-bold text-slate-900">Book Appointment / Walk-In</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Customer *</label>
            <select
              required
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value, vehicle: '' })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Customer...</option>
              {(customersRes?.data || []).map((c) => (
                <option key={c._id} value={c._id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Vehicle *</label>
            <select
              required
              value={form.vehicle}
              onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Vehicle...</option>
              {(vehiclesRes?.data || []).map((v) => (
                <option key={v._id} value={v._id}>
                  {v.registrationNumber} — {v.make} {v.model}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="walk-in-toggle"
              type="checkbox"
              checked={form.isWalkIn}
              onChange={(e) => setForm({ ...form, isWalkIn: e.target.checked })}
            />
            <label htmlFor="walk-in-toggle" className="text-xs font-semibold text-slate-700">
              Immediate Walk-In Customer (marks status Arrived)
            </label>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Requested Service *</label>
            <input
              required
              value={form.requestedService}
              onChange={(e) => setForm({ ...form, requestedService: e.target.value })}
              placeholder="Full Periodic Service / Brake Overhaul"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Scheduled Date & Time *</label>
            <input
              type="datetime-local"
              required
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-2 px-4 rounded-lg bg-brandRed-600 hover:bg-brandRed-700 text-white font-semibold text-sm"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Booking'}
          </button>
        </form>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="p-3">Scheduled</th>
                <th className="p-3">Customer & Vehicle</th>
                <th className="p-3">Requested Service</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(apptsRes?.data || []).map((a) => (
                <tr key={a._id} className="hover:bg-slate-50">
                  <td className="p-3 text-xs">{formatDateTimeLK(a.scheduledAt)}</td>
                  <td className="p-3">
                    <div className="font-semibold">{a.customer?.name}</div>
                    <div className="text-xs font-mono text-slate-500">{a.vehicle?.registrationNumber}</div>
                  </td>
                  <td className="p-3 text-xs">{a.requestedService}</td>
                  <td className="p-3">
                    <select
                      value={a.status}
                      onChange={(e) => statusMutation.mutate({ id: a._id, status: e.target.value, __v: a.__v })}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold"
                    >
                      {['Scheduled', 'Confirmed', 'Arrived', 'Cancelled', 'No-show'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-right">
                    {a.convertedJobCard ? (
                      <span className="text-xs font-mono text-emerald-700 font-semibold">
                        {a.convertedJobCard.jobNumber}
                      </span>
                    ) : a.status === 'Arrived' ? (
                      <button
                        type="button"
                        onClick={() => convertToJobMutation.mutate(a)}
                        className="px-2.5 py-1 rounded bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold"
                      >
                        Convert to Job Card
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
