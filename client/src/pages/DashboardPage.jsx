import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, formatLkr, formatDateTimeLK } from '../lib/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest('/api/dashboard'),
  });

  if (isLoading) return <div className="p-6 text-sm text-slate-500">Loading real-time workshop telemetry...</div>;
  if (error) return <div className="p-6 text-sm text-rose-600">Failed to load dashboard: {error.message}</div>;

  const d = data?.data || {};
  const canSeeFinancials = ['admin', 'cashier', 'receptionist'].includes(user?.role);

  const cards = [
    { label: "Today's Appointments", value: d.todaysAppointmentsCount ?? 0, tone: 'border-blue-500' },
    { label: 'Vehicles in Workshop', value: d.vehiclesInWorkshopCount ?? 0, tone: 'border-indigo-500' },
    { label: 'Awaiting Customer Approval', value: d.jobsAwaitingApprovalCount ?? 0, tone: 'border-amber-500' },
    { label: 'Jobs Waiting for Parts', value: d.jobsWaitingForPartsCount ?? 0, tone: 'border-orange-500' },
    { label: 'Ready for Collection', value: d.vehiclesReadyForCollectionCount ?? 0, tone: 'border-emerald-500' },
    { label: 'Low-Stock Parts Alert', value: d.lowStockPartsCount ?? 0, tone: 'border-brandRed-600' },
  ];

  if (canSeeFinancials) {
    cards.push(
      { label: "Today's Payments Received", value: formatLkr(d.todaysPaymentsMinor || 0), tone: 'border-teal-600' },
      { label: 'Outstanding Invoice Balances', value: formatLkr(d.outstandingInvoiceBalanceMinor || 0), tone: 'border-rose-600' }
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Workshop Live Dashboard</h2>
        <p className="text-sm text-slate-600">
          Real-time MongoDB-backed operational & financial indicators for USA Auto Care, Alawwa
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${c.tone}`}>
            <p className="text-xs font-medium text-slate-500 uppercase">{c.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {canSeeFinancials && d.collectionsSeries?.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                7-Day Invoiced Revenue vs. Cash Collections (LKR)
              </h3>
              <p className="text-xs text-slate-500">
                Invoiced Revenue = Grand total of non-voided invoices issued on date • Cash Collections = Actual non-reversed payments received on date
              </p>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 items-end h-44 pt-4 border-t border-slate-100">
            {d.collectionsSeries.map((point) => {
              const maxMinor = Math.max(
                100000,
                ...d.collectionsSeries.map((x) => Math.max(x.invoicedMinor, x.collectedMinor))
              );
              const invHeight = Math.round((point.invoicedMinor / maxMinor) * 100);
              const colHeight = Math.round((point.collectedMinor / maxMinor) * 100);
              return (
                <div key={point.date} className="flex flex-col items-center gap-1 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1 h-28">
                    <div
                      title={`Invoiced: ${formatLkr(point.invoicedMinor)}`}
                      style={{ height: `${Math.max(4, invHeight)}%` }}
                      className="w-3 bg-navy-800 rounded-t"
                    />
                    <div
                      title={`Collected: ${formatLkr(point.collectedMinor)}`}
                      style={{ height: `${Math.max(4, colHeight)}%` }}
                      className="w-3 bg-brandRed-600 rounded-t"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">{point.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-3">Low-Stock Parts Requiring Reorder</h3>
          {d.lowStockParts?.length === 0 ? (
            <p className="text-sm text-slate-500">All workshop inventory items are above reorder thresholds.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase">
                    <th className="py-2">SKU</th>
                    <th className="py-2">Part Name</th>
                    <th className="py-2 text-right">On Hand</th>
                    <th className="py-2 text-right">Threshold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.lowStockParts?.map((p) => (
                    <tr key={p._id}>
                      <td className="py-2 font-mono font-semibold">{p.sku}</td>
                      <td className="py-2">{p.name}</td>
                      <td className="py-2 text-right font-bold text-brandRed-600">
                        {p.quantityOnHand} {p.unit}
                      </td>
                      <td className="py-2 text-right text-slate-500">{p.reorderThreshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-3">Recent Workshop Audit Activity</h3>
          <ul className="divide-y divide-slate-100 text-xs">
            {(d.recentActivity || []).map((act) => (
              <li key={act._id} className="py-2.5 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{act.summary}</p>
                  <p className="text-slate-500">
                    By {act.performedByName} ({act.performedByRole})
                  </p>
                </div>
                <span className="text-slate-400 shrink-0">{formatDateTimeLK(act.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
