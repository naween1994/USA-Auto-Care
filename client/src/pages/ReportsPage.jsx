import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, formatLkr } from '../lib/apiClient.js';
import { AdminRecordAction } from '../components/AdminRecordAction.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function ReportsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expForm, setExpForm] = useState({
    category: 'Utilities',
    amountLkr: '',
    incurredOn: new Date().toISOString().slice(0, 10),
    vendorName: '',
    notes: '',
  });

  const { data: reportRes } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: () => apiRequest('/api/finance/reports/summary'),
  });

  const { data: expensesRes } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => apiRequest('/api/finance/expenses'),
  });

  const addExpense = useMutation({
    mutationFn: (payload) => apiRequest('/api/finance/expenses', { method: 'POST', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      setExpForm({ ...expForm, amountLkr: '', notes: '' });
    },
  });

  const m = reportRes?.data?.metrics || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Financial Reports, Gross Profit & Expenses</h2>
          <p className="text-sm text-slate-600">
            Strictly distinguishes Invoiced Sales (accrual), Payments Received (cash collections), and Estimated Job Gross Profit
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/finance/reports/export-csv?type=invoices"
            className="px-3 py-2 rounded-lg bg-navy-900 text-white text-xs font-semibold"
          >
            Export Invoices CSV
          </a>
          <a
            href="/api/finance/reports/export-csv?type=expenses"
            className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold"
          >
            Export Expenses CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs uppercase text-slate-500 font-semibold">Invoiced Sales (Revenue)</p>
          <p className="text-xl font-bold mt-1">{formatLkr(m.invoicedSalesMinor)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs uppercase text-slate-500 font-semibold">Cash Collections Received</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{formatLkr(m.paymentsReceivedMinor)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs uppercase text-slate-500 font-semibold">Est. Job Gross Profit</p>
          <p className="text-xl font-bold text-indigo-700 mt-1">{formatLkr(m.estimatedJobGrossProfitMinor)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs uppercase text-slate-500 font-semibold">Recorded Workshop Expenses</p>
          <p className="text-xl font-bold text-brandRed-600 mt-1">{formatLkr(m.totalExpensesMinor)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addExpense.mutate(expForm);
          }}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3 h-fit"
        >
          <h3 className="text-base font-bold text-slate-900">Record Workshop Expense</h3>
          <select
            value={expForm.category}
            onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {['Utilities', 'Workshop Consumables', 'Tools & Equipment', 'Rent', 'Staff Welfare', 'Transport', 'Other'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            required
            placeholder="Amount (LKR)"
            value={expForm.amountLkr}
            onChange={(e) => setExpForm({ ...expForm, amountLkr: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            required
            value={expForm.incurredOn}
            onChange={(e) => setExpForm({ ...expForm, incurredOn: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Expense description / notes"
            value={expForm.notes}
            onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={addExpense.isPending}
            className="w-full py-2 px-4 rounded-lg bg-brandRed-600 text-white font-semibold text-sm"
          >
            Save Expense
          </button>
        </form>

        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-3">Expense Ledger</h3>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500 uppercase">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Category</th>
                <th className="py-2">Notes</th>
                <th className="py-2 text-right">Amount</th>
                {user?.role === 'admin' && <th className="py-2 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(expensesRes?.data || []).map((e) => (
                <tr key={e._id}>
                  <td className="py-2">{new Date(e.incurredOn).toISOString().slice(0, 10)}</td>
                  <td className="py-2 font-semibold">{e.category}</td>
                  <td className="py-2">{e.notes}</td>
                  <td className="py-2 text-right font-mono font-bold">{formatLkr(e.amountMinor)}</td>
                  {user?.role === 'admin' && (
                    <td className="py-2 text-right">
                      <AdminRecordAction
                        recordType="expenses"
                        recordId={e._id}
                        recordLabel={`expense ${e.category}`}
                        compact
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
