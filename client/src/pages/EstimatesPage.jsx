import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, formatLkr, formatDateTimeLK } from '../lib/apiClient.js';
import { AdminRecordAction } from '../components/AdminRecordAction.jsx';

export function EstimatesPage() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState(null);
  const [jobCardId, setJobCardId] = useState('');
  const [partName, setPartName] = useState('Synthetic 0W-20 Engine Oil (4L)');
  const [partPriceLkr, setPartPriceLkr] = useState(14500);
  const [labourDesc, setLabourDesc] = useState('Periodic Service Labour');
  const [labourRateLkr, setLabourRateLkr] = useState(3500);
  const [discountLkr, setDiscountLkr] = useState(0);
  const [approvalCustomerName, setApprovalCustomerName] = useState('');
  const [approvalMethod, setApprovalMethod] = useState('Phone');

  const { data: estimatesRes } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => apiRequest('/api/estimates'),
  });

  const { data: jobsRes } = useQuery({
    queryKey: ['jobCards', 'dropdown'],
    queryFn: () => apiRequest('/api/job-cards'),
  });

  const createEstimate = useMutation({
    mutationFn: (payload) => apiRequest('/api/estimates', { method: 'POST', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimates'] });
      setMsg({ type: 'success', text: 'Estimate calculated on server and saved to MongoDB.' });
    },
    onError: (err) => setMsg({ type: 'error', text: err.message }),
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, payload }) => apiRequest(`/api/estimates/${id}/approval`, { method: 'PATCH', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimates'] });
      setMsg({ type: 'success', text: 'Customer approval recorded and audited.' });
    },
    onError: (err) => setMsg({ type: 'error', text: err.message }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Estimates & Customer Approvals</h2>
        <p className="text-sm text-slate-600">
          Authoritative server-calculated totals, revision history preservation, and audited Phone / In-Person approval recording
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
            createEstimate.mutate({
              jobCard: jobCardId,
              parts: [{ name: partName, quantity: 1, unitPriceLkr: Number(partPriceLkr) }],
              labour: [{ description: labourDesc, hours: 1, rateLkr: Number(labourRateLkr) }],
              discountLkr: Number(discountLkr),
            });
          }}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3 h-fit"
        >
          <h3 className="text-base font-bold text-slate-900">Create Job Estimate</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Job Card *</label>
            <select
              required
              value={jobCardId}
              onChange={(e) => setJobCardId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Job Card...</option>
              {(jobsRes?.data || []).map((j) => (
                <option key={j._id} value={j._id}>
                  {j.jobNumber} — {j.vehicle?.registrationNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Primary Part Line</label>
            <input
              required
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-1"
            />
            <input
              type="number"
              required
              value={partPriceLkr}
              onChange={(e) => setPartPriceLkr(e.target.value)}
              placeholder="Price in LKR"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Labour Line</label>
            <input
              required
              value={labourDesc}
              onChange={(e) => setLabourDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-1"
            />
            <input
              type="number"
              required
              value={labourRateLkr}
              onChange={(e) => setLabourRateLkr(e.target.value)}
              placeholder="Labour in LKR"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Discount (LKR)</label>
            <input
              type="number"
              value={discountLkr}
              onChange={(e) => setDiscountLkr(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={createEstimate.isPending}
            className="w-full py-2 px-4 rounded-lg bg-brandRed-600 hover:bg-brandRed-700 text-white font-semibold text-sm"
          >
            {createEstimate.isPending ? 'Calculating & Saving...' : 'Create Estimate'}
          </button>
        </form>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-700">Approval Recording Controls:</span>
            <select
              value={approvalMethod}
              onChange={(e) => setApprovalMethod(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            >
              <option value="Phone">Phone Call Approval</option>
              <option value="In-Person">In-Person Customer Approval</option>
            </select>
            <input
              placeholder="Approving customer name..."
              value={approvalCustomerName}
              onChange={(e) => setApprovalCustomerName(e.target.value)}
              className="rounded border border-slate-300 px-2.5 py-1 flex-1"
            />
          </div>

          <div className="space-y-3">
            {(estimatesRes?.data || []).map((est) => (
              <div key={est._id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <span className="font-mono font-bold text-sm">{est.estimateNumber}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      Rev #{est.currentRevision} • Job {est.jobCard?.jobNumber} ({est.vehicle?.registrationNumber})
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100">
                    {est.status}
                  </span>
                  <AdminRecordAction
                    recordType="estimates"
                    recordId={est._id}
                    recordLabel={`estimate ${est.estimateNumber}`}
                    compact
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Parts: {formatLkr(est.partsSubtotalMinor)} | Labour: {formatLkr(est.labourSubtotalMinor)}</span>
                  <span className="font-bold text-slate-900">Grand Total: {formatLkr(est.grandTotalMinor)}</span>
                </div>
                {est.approvalDetails?.approvedAt && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded">
                    Approved by <strong>{est.approvalDetails.approvingCustomerName}</strong> via{' '}
                    <strong>{est.approvalDetails.method}</strong> at {formatDateTimeLK(est.approvalDetails.approvedAt)}{' '}
                    (Recorded by {est.approvalDetails.recordedByName})
                  </p>
                )}
                {est.status !== 'Approved' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        approvalMutation.mutate({
                          id: est._id,
                          payload: {
                            status: 'Approved',
                            method: approvalMethod,
                            approvingCustomerName: approvalCustomerName || est.customer?.name || 'Customer',
                            __v: est.__v,
                          },
                        })
                      }
                      className="px-3 py-1 rounded bg-emerald-600 text-white text-xs font-semibold"
                    >
                      Record Customer Approval
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        approvalMutation.mutate({
                          id: est._id,
                          payload: { status: 'Rejected', __v: est.__v },
                        })
                      }
                      className="px-3 py-1 rounded bg-rose-600 text-white text-xs font-semibold"
                    >
                      Mark Rejected
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
