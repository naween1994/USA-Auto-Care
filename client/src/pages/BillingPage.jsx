import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { apiRequest, formatLkr, formatDateTimeLK } from '../lib/apiClient.js';

export function BillingPage() {
  const qc = useQueryClient();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [jobCardId, setJobCardId] = useState('');
  const [payAmountLkr, setPayAmountLkr] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [msg, setMsg] = useState(null);

  const { data: invoicesRes } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiRequest('/api/billing/invoices'),
  });

  const { data: invoiceDetailRes } = useQuery({
    queryKey: ['invoices', 'detail', selectedInvoiceId],
    queryFn: () => apiRequest(`/api/billing/invoices/${selectedInvoiceId}`),
    enabled: Boolean(selectedInvoiceId),
  });

  const { data: jobsRes } = useQuery({
    queryKey: ['jobCards', 'billingDropdown'],
    queryFn: () => apiRequest('/api/job-cards'),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (payload) => apiRequest('/api/billing/invoices/from-job', { method: 'POST', body: payload }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvoiceId(res.data._id);
      setMsg({ type: 'success', text: `Invoice ${res.data.invoiceNumber} generated from Job Card.` });
    },
    onError: (err) => setMsg({ type: 'error', text: err.message }),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (payload) => apiRequest('/api/billing/payments', { method: 'POST', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      setPayAmountLkr('');
      setMsg({ type: 'success', text: 'Payment recorded with idempotency protection.' });
    },
    onError: (err) => setMsg({ type: 'error', text: err.message }),
  });

  const voidInvoiceMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      apiRequest(`/api/billing/invoices/${id}/void`, { method: 'POST', body: { reason } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices', 'detail', selectedInvoiceId] });
      setMsg({ type: 'success', text: `Invoice ${res.data.invoiceNumber} was voided for audit.` });
    },
    onError: (err) => setMsg({ type: 'error', text: err.message }),
  });

  const inv = invoiceDetailRes?.data;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h2 className="text-2xl font-bold text-slate-900">Invoices, Payments & A4 Print Layout</h2>
        <p className="text-sm text-slate-600">
          One-click invoice generation from Job Cards, idempotent partial/full payments, and A4 Print/PDF support
        </p>
      </div>

      {msg && (
        <div className={`no-print p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {msg.text}
        </div>
      )}

      <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createInvoiceMutation.mutate({ jobCardId });
          }}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3 h-fit"
        >
          <h3 className="text-base font-bold text-slate-900">Generate Invoice from Job Card</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Job Card with Approved Estimate *</label>
            <select
              required
              value={jobCardId}
              onChange={(e) => setJobCardId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Job Card...</option>
              {(jobsRes?.data || []).map((j) => (
                <option key={j._id} value={j._id}>
                  {j.jobNumber} — {j.vehicle?.registrationNumber} ({j.status})
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500">
            The invoice uses this job’s current approved estimate, including its descriptions, prices, discount, and tax.
          </p>
          <button
            type="submit"
            disabled={createInvoiceMutation.isPending}
            className="w-full py-2 px-4 rounded-lg bg-brandRed-600 hover:bg-brandRed-700 text-white font-semibold text-sm"
          >
            {createInvoiceMutation.isPending ? 'Generating...' : 'Generate Invoice'}
          </button>
        </form>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="p-3">Invoice #</th>
                <th className="p-3">Customer & Vehicle</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Balance Due</th>
                <th className="p-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(invoicesRes?.data || []).map((item) => (
                <tr key={item._id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold">{item.invoiceNumber}</td>
                  <td className="p-3">
                    <div>{item.customer?.name}</div>
                    <div className="text-xs font-mono text-slate-500">{item.vehicle?.registrationNumber}</div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100">
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono">{formatLkr(item.grandTotalMinor)}</td>
                  <td className="p-3 text-right font-mono font-bold text-brandRed-600">
                    {formatLkr(item.balanceDueMinor)}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedInvoiceId(item._id)}
                      className="text-xs font-semibold text-navy-900 hover:underline"
                    >
                      View / Pay / Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* A4 Printable Invoice & Payment Panel */}
      {inv && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 max-w-4xl mx-auto space-y-6">
          <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const idempotencyKey = `pay-${inv._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                recordPaymentMutation.mutate({
                  invoiceId: inv._id,
                  customerId: inv.customer?._id,
                  paymentType: payMethod === 'Deposit Allocation' ? 'DEPOSIT_ALLOCATION' : 'INVOICE_PAYMENT',
                  method: payMethod,
                  amountLkr: Number(payAmountLkr),
                  idempotencyKey,
                });
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Card Record</option>
                <option value="Deposit Allocation">Customer Deposit Allocation</option>
              </select>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Amount (LKR)"
                value={payAmountLkr}
                onChange={(e) => setPayAmountLkr(e.target.value)}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-xs w-36"
              />
              <button
                type="submit"
                disabled={recordPaymentMutation.isPending || inv.balanceDueMinor === 0}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                Record Payment
              </button>
            </form>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-semibold"
            >
              <Printer className="w-4 h-4" />
              Print A4 / Save as PDF
            </button>
          </div>

          {inv.grandTotalMinor === 0 && !inv.isVoided && (
            <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <span>This legacy invoice has a zero total. Void it with an audit reason before issuing a corrected invoice.</span>
              <button
                type="button"
                disabled={voidInvoiceMutation.isPending}
                onClick={() => {
                  const reason = window.prompt('Reason for voiding this zero-total invoice:');
                  if (reason?.trim()) voidInvoiceMutation.mutate({ id: inv._id, reason: reason.trim() });
                }}
                className="rounded bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {voidInvoiceMutation.isPending ? 'Voiding...' : 'Void zero-total invoice'}
              </button>
            </div>
          )}

          {/* Printable A4 Header */}
          <div className="flex justify-between items-start border-b-2 border-navy-900 pb-4">
            <div>
              <img src="/logo.png" alt="USA Auto Care Logo" className="h-14 w-auto object-contain mb-2" />
              <h1 className="text-2xl font-bold text-navy-900">{inv.businessSnapshot?.businessName || 'USA Auto Care'}</h1>
              <p className="text-xs text-slate-600">Hotlines: 0773995399 / 0703995399 • Email: usaautocare66@gmail.com</p>
              <p className="text-xs text-slate-600">{inv.businessSnapshot?.location || 'Alawwa, Sri Lanka'}</p>
              {inv.businessSnapshot?.address && <p className="text-xs text-slate-600">{inv.businessSnapshot.address}</p>}
              {inv.businessSnapshot?.phone && <p className="text-xs text-slate-600">Tel: {inv.businessSnapshot.phone}</p>}
              {inv.businessSnapshot?.taxRegistrationNumber && (
                <p className="text-xs text-slate-600">Tax Reg: {inv.businessSnapshot.taxRegistrationNumber}</p>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold uppercase text-brandRed-600">Tax / Service Invoice</h2>
              <p className="text-sm font-mono font-bold">{inv.invoiceNumber}</p>
              {inv.estimateNumber && (
                <p className="text-xs text-slate-500">
                  Estimate: {inv.estimateNumber} Rev #{inv.estimateRevision}
                </p>
              )}
              <p className="text-xs text-slate-500">Issued: {formatDateTimeLK(inv.createdAt)}</p>
              <p className="text-xs font-semibold mt-1">Status: {inv.status}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-bold uppercase text-slate-500">Billed To</p>
              <p className="font-semibold text-sm">{inv.customer?.name}</p>
              <p>{inv.customer?.phone}</p>
              <p>{inv.customer?.address}</p>
            </div>
            <div className="text-right">
              <p className="font-bold uppercase text-slate-500">Vehicle & Job Reference</p>
              <p className="font-mono font-bold text-sm">{inv.vehicle?.registrationNumber}</p>
              <p>{inv.vehicle?.make} {inv.vehicle?.model}</p>
              <p>Job Reference: {inv.jobCard?.jobNumber}</p>
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-50 uppercase text-slate-600">
                <th className="py-2 px-2">Description</th>
                <th className="py-2 px-2 text-right">Qty / Hrs</th>
                <th className="py-2 px-2 text-right">Unit Rate</th>
                <th className="py-2 px-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(inv.parts || []).map((p, idx) => (
                <tr key={idx}>
                  <td className="py-2 px-2">
                    [Part] {p.name} {p.isCustomerSupplied ? '(Customer Supplied)' : ''}
                  </td>
                  <td className="py-2 px-2 text-right font-mono">{p.quantity}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatLkr(p.unitPriceMinor)}</td>
                  <td className="py-2 px-2 text-right font-mono font-semibold">{formatLkr(p.lineTotalMinor)}</td>
                </tr>
              ))}
              {(inv.labour || []).map((l, idx) => (
                <tr key={idx}>
                  <td className="py-2 px-2">[Labour] {l.description}</td>
                  <td className="py-2 px-2 text-right font-mono">{l.hours}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatLkr(l.rateMinor)}</td>
                  <td className="py-2 px-2 text-right font-mono font-semibold">{formatLkr(l.lineTotalMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-72 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Parts Subtotal:</span>
                <span className="font-mono">{formatLkr(inv.partsSubtotalMinor)}</span>
              </div>
              <div className="flex justify-between">
                <span>Labour Subtotal:</span>
                <span className="font-mono">{formatLkr(inv.labourSubtotalMinor)}</span>
              </div>
              {inv.discountMinor > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-mono">-{formatLkr(inv.discountMinor)}</span>
                </div>
              )}
              {inv.taxEnabled && (
                <div className="flex justify-between">
                  <span>Tax ({inv.taxRatePercent}%):</span>
                  <span className="font-mono">{formatLkr(inv.taxAmountMinor)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t border-slate-300 pt-1">
                <span>Grand Total:</span>
                <span className="font-mono">{formatLkr(inv.grandTotalMinor)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Payments Received:</span>
                <span className="font-mono">{formatLkr(inv.paidMinor)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-brandRed-600 border-t border-slate-300 pt-1">
                <span>Balance Due:</span>
                <span className="font-mono">{formatLkr(inv.balanceDueMinor)}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-3">
            {inv.businessSnapshot?.invoiceFooter}
          </p>
        </div>
      )}
    </div>
  );
}
