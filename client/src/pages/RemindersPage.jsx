import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, formatDateTimeLK } from '../lib/apiClient.js';

export function RemindersPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => apiRequest('/api/reminders'),
  });

  const markContacted = useMutation({
    mutationFn: (id) =>
      apiRequest(`/api/reminders/${id}/contacted`, {
        method: 'PATCH',
        body: { status: 'Contacted', contactMethod: 'Phone Call' },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Service Follow-Ups & Reminders</h2>
        <p className="text-sm text-slate-600">
          Upcoming and overdue maintenance reminders by date and mileage. Staff manually record customer contact (integration-ready for future SMS/WhatsApp gateway).
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="p-3">Due Date / Mileage</th>
              <th className="p-3">Vehicle</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Staff Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data?.data || []).map((r) => (
              <tr key={r._id}>
                <td className="p-3 text-xs">
                  <div className="font-semibold">{formatDateTimeLK(r.dueDate)}</div>
                  {r.dueMileageKm && <div className="text-slate-500">Target: {r.dueMileageKm.toLocaleString()} km</div>}
                </td>
                <td className="p-3 font-mono font-bold">{r.vehicle?.registrationNumber}</td>
                <td className="p-3">
                  <div>{r.customer?.name}</div>
                  <div className="text-xs text-slate-500">{r.customer?.phone}</div>
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100">{r.status}</span>
                </td>
                <td className="p-3 text-right">
                  {r.status === 'Pending' && (
                    <button
                      type="button"
                      onClick={() => markContacted.mutate(r._id)}
                      className="px-3 py-1 rounded bg-navy-900 text-white text-xs font-semibold"
                    >
                      Mark Contacted
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
