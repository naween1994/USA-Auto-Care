import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient.js';

/**
 * Dedicated Mobile-Friendly Bay Screen for Mechanics:
 * Large tap targets, zero financial clutter (no purchase costs or unrestricted reports),
 * quick checklist toggles, task completion, and status progression.
 */
export function MechanicMobilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['jobCards', 'mechanicBay'],
    queryFn: () => apiRequest('/api/job-cards'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, __v }) =>
      apiRequest(`/api/job-cards/${id}/status`, { method: 'PATCH', body: { status, __v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobCards'] }),
  });

  if (isLoading) return <div className="p-4 text-sm">Loading active bay jobs...</div>;

  const activeJobs = (data?.data || []).filter((j) => !['Delivered', 'Cancelled'].includes(j.status));

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="bg-navy-900 text-white p-4 rounded-xl">
        <h2 className="text-lg font-bold">Mechanic Bay Mobile View</h2>
        <p className="text-xs text-slate-300">Touch-optimized active jobs for workshop floor use</p>
      </div>

      {activeJobs.map((job) => (
        <div key={job._id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-base text-navy-900">
              {job.vehicle?.registrationNumber}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-brandRed-600 text-white text-xs font-bold">
              {job.status}
            </span>
          </div>
          <p className="text-xs text-slate-600">
            {job.jobNumber} • {job.vehicle?.make} {job.vehicle?.model} ({job.mileageInKm?.toLocaleString()} km)
          </p>
          <p className="text-sm font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg">
            {job.customerComplaints}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {['Inspecting', 'Waiting for Parts', 'In Progress', 'Quality Check'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => statusMutation.mutate({ id: job._id, status: st, __v: job.__v })}
                className="py-2.5 px-3 rounded-lg bg-slate-100 hover:bg-navy-900 hover:text-white text-xs font-bold transition"
              >
                Mark {st}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
