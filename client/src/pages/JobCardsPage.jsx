import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, formatLkr, formatDateTimeLK } from '../lib/apiClient.js';
import { AdminRecordAction } from '../components/AdminRecordAction.jsx';

const ALLOWED_NEXT = {
  'Checked In': ['Inspecting', 'Awaiting Approval', 'In Progress', 'Cancelled'],
  'Inspecting': ['Awaiting Approval', 'Waiting for Parts', 'In Progress', 'Cancelled'],
  'Awaiting Approval': ['Inspecting', 'Waiting for Parts', 'In Progress', 'Cancelled'],
  'Waiting for Parts': ['In Progress', 'Awaiting Approval', 'Cancelled'],
  'In Progress': ['Waiting for Parts', 'Quality Check', 'Awaiting Approval', 'Cancelled'],
  'Quality Check': ['In Progress'],
  'Ready to Collect': ['Delivered', 'Quality Check'],
  'Ready for Collection': ['Delivered', 'Quality Check'],
  'Delivered': [],
  'Cancelled': [],
};

export function JobCardsPage() {
  const qc = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [issueForm, setIssueForm] = useState({ partId: '', quantity: 1, isCustomerSupplied: false, name: '' });

  const { data: jobsRes } = useQuery({
    queryKey: ['jobCards'],
    queryFn: () => apiRequest('/api/job-cards'),
  });

  const { data: selectedJobRes } = useQuery({
    queryKey: ['jobCards', 'detail', selectedJobId],
    queryFn: () => apiRequest(`/api/job-cards/${selectedJobId}`),
    enabled: Boolean(selectedJobId),
  });

  const { data: partsRes } = useQuery({
    queryKey: ['inventory', 'parts'],
    queryFn: () => apiRequest('/api/inventory/parts'),
  });

  const { data: mechanicsRes } = useQuery({
    queryKey: ['staff', 'mechanics'],
    queryFn: () => apiRequest('/api/auth/staff?role=mechanic'),
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, payload }) => apiRequest(`/api/job-cards/${id}`, { method: 'PUT', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobCards'] });
      setFeedback({ type: 'success', text: 'Job card saved to MongoDB.' });
    },
    onError: (err) => setFeedback({ type: 'error', text: err.message }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, __v }) =>
      apiRequest(`/api/job-cards/${id}/status`, { method: 'PATCH', body: { status, __v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobCards'] });
      setFeedback({ type: 'success', text: 'Job status transition verified and saved.' });
    },
    onError: (err) => setFeedback({ type: 'error', text: err.message }),
  });

  const issuePartMutation = useMutation({
    mutationFn: ({ id, payload }) => apiRequest(`/api/job-cards/${id}/parts/issue`, { method: 'POST', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobCards'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setFeedback({ type: 'success', text: 'Part issued to job card and workshop stock decremented atomically.' });
    },
    onError: (err) => setFeedback({ type: 'error', text: err.message }),
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ id, file, caption }) => {
      const fd = new FormData();
      fd.append('photo', file);
      fd.append('caption', caption || '');
      return apiRequest(`/api/job-cards/${id}/photos`, {
        method: 'POST',
        body: fd,
        isFormData: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobCards'] });
      setFeedback({ type: 'success', text: 'Inspection photo uploaded and stored.' });
    },
    onError: (err) => setFeedback({ type: 'error', text: err.message }),
  });

  const activeJob = selectedJobRes?.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Job Cards, 8-Point Inspection & Parts Issue</h2>
        <p className="text-sm text-slate-600">
          Concurrent-safe job numbers, validated status workflow, photo uploads, and atomic stock consumption
        </p>
      </div>

      {feedback && (
        <div className={`p-3 rounded-lg text-sm font-medium ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
          <div className="p-3 bg-slate-100 text-xs font-bold uppercase text-slate-600">
            Workshop Job Queue ({(jobsRes?.data || []).length})
          </div>
          <ul className="divide-y divide-slate-100">
            {(jobsRes?.data || []).map((j) => (
              <li
                key={j._id}
                onClick={() => setSelectedJobId(j._id)}
                className={`p-3 cursor-pointer hover:bg-slate-50 ${
                  selectedJobId === j._id ? 'bg-rose-50/50 border-l-4 border-brandRed-600' : ''
                }`}
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="font-mono font-bold text-sm">{j.jobNumber}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 font-semibold">{j.status}</span>
                    <AdminRecordAction
                      recordType="jobCards"
                      recordId={j._id}
                      recordLabel={`job card ${j.jobNumber}`}
                      compact
                      onDeleted={() => {
                        if (selectedJobId === j._id) setSelectedJobId(null);
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs font-semibold mt-1">
                  {j.vehicle?.registrationNumber} — {j.vehicle?.make} {j.vehicle?.model}
                </p>
                <p className="text-xs text-slate-500 truncate">{j.customerComplaints}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2">
          {!activeJob ? (
            <div className="bg-white rounded-xl p-8 text-center text-sm text-slate-500 border border-slate-200">
              Select a Job Card from the queue on the left to inspect, assign a mechanic, issue parts, or transition status.
            </div>
          ) : (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {activeJob.jobNumber} — {activeJob.vehicle?.registrationNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Customer: {activeJob.customer?.name} ({activeJob.customer?.phone}) • Check-in Mileage: {activeJob.mileageInKm?.toLocaleString()} km
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-navy-900 text-white">
                    {activeJob.status === 'Ready for Collection' ? 'Ready to Collect' : activeJob.status}
                  </span>
                  {(ALLOWED_NEXT[activeJob.status] || []).map((nextSt) => (
                    <button
                      key={nextSt}
                      type="button"
                      onClick={() => statusMutation.mutate({ id: activeJob._id, status: nextSt, __v: activeJob.__v })}
                      className="px-2.5 py-1 rounded bg-brandRed-600 hover:bg-brandRed-700 text-white text-xs font-semibold"
                    >
                      → {nextSt}
                    </button>
                  ))}
                  {activeJob.status === 'Quality Check' &&
                    activeJob.qualityCheckPassed &&
                    activeJob.assignedMechanic && (
                      <button
                        type="button"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({
                          id: activeJob._id,
                          status: 'Ready to Collect',
                          __v: activeJob.__v,
                        })}
                        className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        Ready to Collect
                      </button>
                    )}
                </div>
              </div>

              {/* 8-Point Inspection Checklist */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-600 mb-2">
                  8-Point Mechanical Inspection (Oil, Coolant, Brakes, Tyres, Battery, Lights, Belts, Leaks)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(activeJob.inspectionChecklist || []).map((item, idx) => (
                    <div key={item.key} className="p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-medium">{item.label}</span>
                      <select
                        value={item.status}
                        onChange={(e) => {
                          const updated = [...activeJob.inspectionChecklist];
                          updated[idx] = { ...item, status: e.target.value };
                          updateJobMutation.mutate({
                            id: activeJob._id,
                            payload: { inspectionChecklist: updated, __v: activeJob.__v },
                          });
                        }}
                        className="rounded border border-slate-300 px-2 py-1 font-semibold"
                      >
                        <option value="Good">Good</option>
                        <option value="Attention Needed">Attention Needed</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mechanic Assignment & Quality Check */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned Mechanic</label>
                  <select
                    value={activeJob.assignedMechanic?._id || ''}
                    onChange={(e) =>
                      updateJobMutation.mutate({
                        id: activeJob._id,
                        payload: { assignedMechanic: e.target.value || null, __v: activeJob.__v },
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {(mechanicsRes?.data || []).map((m) => (
                      <option key={m._id} value={m._id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-5">
                  {activeJob.status === 'Quality Check' && activeJob.assignedMechanic ? (
                    <div className="flex items-center gap-2">
                      <input
                        id="qc-passed-checkbox"
                        type="checkbox"
                        checked={Boolean(activeJob.qualityCheckPassed)}
                        onChange={(e) =>
                          updateJobMutation.mutate({
                            id: activeJob._id,
                            payload: { qualityCheckPassed: e.target.checked, __v: activeJob.__v },
                          })
                        }
                      />
                      <label htmlFor="qc-passed-checkbox" className="text-xs font-semibold text-slate-800">
                        Final Road-Test & Quality Check Verified
                      </label>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {activeJob.assignedMechanic
                        ? 'Move the job to Quality Check after the work is complete to record its final road-test.'
                        : 'Assign a mechanic before proceeding with the job.'}
                    </p>
                  )}
                </div>
              </div>

              {/* Issue Parts to Job */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-600">
                  Issued Parts (Stock Deducted Upon Issue — Never Deducted Twice at Invoicing)
                </h4>
                <ul className="space-y-1 text-xs">
                  {(activeJob.issuedParts || []).map((ip) => (
                    <li key={ip._id} className="p-2 rounded bg-slate-50 border border-slate-200 flex justify-between">
                      <span>
                        <strong>{ip.sku}</strong> — {ip.name} x {ip.quantity - (ip.returnedQuantity || 0)}
                        {ip.isCustomerSupplied ? ' (Customer Supplied - No Stock Deducted)' : ''}
                      </span>
                      <span className="font-mono">{formatLkr(ip.unitPriceMinor * (ip.quantity - (ip.returnedQuantity || 0)))}</span>
                    </li>
                  ))}
                </ul>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    issuePartMutation.mutate({
                      id: activeJob._id,
                      payload: {
                        partId: issueForm.isCustomerSupplied ? null : issueForm.partId,
                        name: issueForm.name,
                        quantity: Number(issueForm.quantity),
                        isCustomerSupplied: issueForm.isCustomerSupplied,
                      },
                    });
                  }}
                  className="flex flex-wrap items-end gap-2 pt-2"
                >
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={issueForm.isCustomerSupplied}
                      onChange={(e) => setIssueForm({ ...issueForm, isCustomerSupplied: e.target.checked })}
                    />
                    Customer-Supplied Part
                  </label>
                  {issueForm.isCustomerSupplied ? (
                    <input
                      required
                      placeholder="Customer part description"
                      value={issueForm.name}
                      onChange={(e) => setIssueForm({ ...issueForm, name: e.target.value })}
                      className="rounded border border-slate-300 px-2.5 py-1.5 text-xs flex-1"
                    />
                  ) : (
                    <select
                      required
                      value={issueForm.partId}
                      onChange={(e) => setIssueForm({ ...issueForm, partId: e.target.value })}
                      className="rounded border border-slate-300 px-2.5 py-1.5 text-xs flex-1"
                    >
                      <option value="">Select Inventory Part...</option>
                      {(partsRes?.data || []).map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.sku} — {p.name} (On Hand: {p.quantityOnHand})
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="number"
                    min="1"
                    required
                    value={issueForm.quantity}
                    onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                    className="w-20 rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={issuePartMutation.isPending}
                    className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-semibold"
                  >
                    Issue Part
                  </button>
                </form>
              </div>

              {/* Photo Upload Section */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <h4 className="text-xs font-bold uppercase text-slate-600">
                  Vehicle Damage & Inspection Photos (JPEG/PNG/WebP, max 5MB)
                </h4>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadPhotoMutation.mutate({ id: activeJob._id, file, caption: 'Workshop inspection photo' });
                    }
                  }}
                  className="text-xs"
                />
                <div className="flex flex-wrap gap-2 pt-2">
                  {(activeJob.photos || []).map((ph) => (
                    <a
                      key={ph._id}
                      href={ph.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brandRed-600 underline"
                    >
                      {ph.originalName}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
