import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, formatLkr, formatDateTimeLK } from '../lib/apiClient.js';

export function VehiclesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    customer: '',
    registrationNumber: '',
    make: '',
    model: '',
    year: 2018,
    fuelType: 'Hybrid',
    transmission: 'Automatic',
    mileageKm: 50000,
    vin: '',
    engineNumber: '',
    notes: '',
  });

  const { data: vehiclesRes } = useQuery({
    queryKey: ['vehicles', search],
    queryFn: () => apiRequest(`/api/vehicles?search=${encodeURIComponent(search)}`),
  });

  const { data: customersRes } = useQuery({
    queryKey: ['customers', 'dropdown'],
    queryFn: () => apiRequest('/api/customers?limit=100'),
  });

  const { data: historyRes } = useQuery({
    queryKey: ['vehicles', 'history', selectedVehicleId],
    queryFn: () => apiRequest(`/api/vehicles/${selectedVehicleId}/history`),
    enabled: Boolean(selectedVehicleId),
  });

  const createVehicle = useMutation({
    mutationFn: (payload) => apiRequest('/api/vehicles', { method: 'POST', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      setMsg({ type: 'success', text: 'Vehicle normalized and saved to MongoDB.' });
      setForm({ ...form, registrationNumber: '', make: '', model: '', vin: '', engineNumber: '' });
    },
    onError: (err) => setMsg({ type: 'error', text: err.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Vehicles & Service History</h2>
          <p className="text-sm text-slate-600">Normalized Sri Lankan registration numbers with complete repair & parts history</p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Reg No (e.g. NW-CAA-4512), Make, VIN..."
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:w-80"
        />
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
            createVehicle.mutate(form);
          }}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3 h-fit"
        >
          <h3 className="text-base font-bold text-slate-900">Register Vehicle</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Owner / Customer *</label>
            <select
              required
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Customer...</option>
              {(customersRes?.data || []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Registration No *</label>
              <input
                required
                value={form.registrationNumber}
                onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                placeholder="NW-CAB-1234"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Year *</label>
              <input
                type="number"
                required
                value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Make *</label>
              <input
                required
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
                placeholder="Toyota"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Model *</label>
              <input
                required
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="Aqua / Axio"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fuel</label>
              <select
                value={form.fuelType}
                onChange={(e) => setForm({ ...form, fuelType: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"
              >
                {['Petrol', 'Diesel', 'Hybrid', 'Electric', 'Other'].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Gearbox</label>
              <select
                value={form.transmission}
                onChange={(e) => setForm({ ...form, transmission: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"
              >
                {['Automatic', 'Manual', 'CVT', 'DCT', 'Other'].map((tr) => (
                  <option key={tr} value={tr}>{tr}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mileage (km)</label>
              <input
                type="number"
                required
                value={form.mileageKm}
                onChange={(e) => setForm({ ...form, mileageKm: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createVehicle.isPending}
            className="w-full py-2 px-4 rounded-lg bg-brandRed-600 hover:bg-brandRed-700 text-white font-semibold text-sm"
          >
            {createVehicle.isPending ? 'Saving...' : 'Save Vehicle'}
          </button>
        </form>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="p-3">Reg Number</th>
                  <th className="p-3">Make & Model</th>
                  <th className="p-3">Owner</th>
                  <th className="p-3 text-right">Mileage</th>
                  <th className="p-3 text-right">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(vehiclesRes?.data || []).map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-navy-900">{v.registrationNumber}</td>
                    <td className="p-3">
                      {v.make} {v.model} ({v.year} • {v.fuelType})
                    </td>
                    <td className="p-3">{v.customer?.name}</td>
                    <td className="p-3 text-right font-mono">{v.mileageKm?.toLocaleString()} km</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedVehicleId(v._id)}
                        className="text-xs font-semibold text-brandRed-600 hover:underline"
                      >
                        Service Log
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {historyRes?.data && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Complete Service History: {historyRes.data.vehicle.registrationNumber} ({historyRes.data.vehicle.make} {historyRes.data.vehicle.model})
              </h3>
              {(historyRes.data.jobs || []).length === 0 ? (
                <p className="text-xs text-slate-500">No service jobs recorded yet for this vehicle.</p>
              ) : (
                <div className="space-y-3">
                  {historyRes.data.jobs.map((j) => (
                    <div key={j._id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>{j.jobNumber} • {j.status}</span>
                        <span>{formatDateTimeLK(j.checkInAt)} • {j.mileageInKm?.toLocaleString()} km</span>
                      </div>
                      <p className="text-slate-700"><strong>Complaints:</strong> {j.customerComplaints}</p>
                      {j.diagnosisNotes && <p className="text-slate-700"><strong>Diagnosis:</strong> {j.diagnosisNotes}</p>}
                      {(j.issuedParts || []).length > 0 && (
                        <p className="text-slate-600">
                          <strong>Parts Replaced:</strong>{' '}
                          {j.issuedParts.map((ip) => `${ip.name} x${ip.quantity - (ip.returnedQuantity || 0)}`).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
