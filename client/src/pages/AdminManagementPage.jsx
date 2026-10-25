import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient.js';
import { PasswordConfirmDialog } from '../components/PasswordConfirmDialog.jsx';

const recordTypes = [
  { value: 'customers', label: 'Customers' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'jobCards', label: 'Job cards' },
  { value: 'estimates', label: 'Estimates' },
  { value: 'parts', label: 'Inventory parts' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'reminders', label: 'Service reminders' },
];

const emptyStaffForm = {
  name: '',
  email: '',
  password: '',
  role: 'receptionist',
  phone: '',
};

export function AdminManagementPage() {
  const queryClient = useQueryClient();
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [recordType, setRecordType] = useState(recordTypes[0].value);
  const [recordPage, setRecordPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [message, setMessage] = useState(null);

  const { data: staffResponse, isLoading: staffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => apiRequest('/api/auth/staff'),
  });
  const { data: recordsResponse, isLoading: recordsLoading } = useQuery({
    queryKey: ['admin-records', recordType, recordPage],
    queryFn: () => apiRequest(`/api/admin/records?type=${recordType}&page=${recordPage}`),
  });

  const createStaff = useMutation({
    mutationFn: (payload) => apiRequest('/api/auth/staff', { method: 'POST', body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setStaffForm(emptyStaffForm);
      setMessage({ type: 'success', text: 'Staff account created.' });
    },
    onError: (error) => setMessage({ type: 'error', text: error.message }),
  });

  const deactivateStaff = useMutation({
    mutationFn: ({ id, password }) =>
      apiRequest(`/api/auth/staff/${id}`, { method: 'DELETE', body: { password } }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['staff'] });
      setDialog(null);
      setMessage({ type: 'success', text: response.message });
    },
  });

  const reactivateStaff = useMutation({
    mutationFn: (id) => apiRequest(`/api/auth/staff/${id}`, { method: 'PATCH', body: { isActive: true } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setMessage({ type: 'success', text: 'Staff account reactivated.' });
    },
    onError: (error) => setMessage({ type: 'error', text: error.message }),
  });

  const archiveRecord = useMutation({
    mutationFn: ({ id, password, isArchived }) =>
      apiRequest(`/api/admin/records/${recordType}/${id}/archive`, {
        method: 'PATCH',
        body: { password, isArchived },
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries();
      setDialog(null);
      setMessage({ type: 'success', text: response.message });
    },
  });

  const selectedRecord = (recordsResponse?.data || []).find((record) => record._id === dialog?.id);
  const activeMutation = dialog?.kind === 'staff' ? deactivateStaff : archiveRecord;
  const dialogError = deactivateStaff.error?.message || archiveRecord.error?.message;
  const recordsPagination = recordsResponse?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">User & Record Management</h2>
        <p className="text-sm text-slate-600">
          Create staff accounts and safely archive operational records. Each archive or staff deactivation requires your current password.
        </p>
      </div>

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg p-3 text-sm ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(null);
            createStaff.mutate(staffForm);
          }}
          className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div>
            <h3 className="font-bold text-slate-900">Add Staff User</h3>
            <p className="mt-1 text-xs text-slate-500">Give the user a temporary password to sign in.</p>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Full name
            <input
              required
              minLength={2}
              value={staffForm.name}
              onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Email
            <input
              required
              type="email"
              value={staffForm.email}
              onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Initial password (at least 8 characters)
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={staffForm.password}
              onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-600">
              Role
              <select
                value={staffForm.role}
                onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="admin">Admin</option>
                <option value="receptionist">Receptionist</option>
                <option value="mechanic">Mechanic</option>
                <option value="cashier">Cashier</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Phone
              <input
                value={staffForm.phone}
                onChange={(event) => setStaffForm({ ...staffForm, phone: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={createStaff.isPending}
            className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {createStaff.isPending ? 'Creating...' : 'Create Staff Account'}
          </button>
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="font-bold text-slate-900">Staff Accounts</h3>
          </div>
          {staffLoading ? (
            <p className="p-5 text-sm text-slate-500">Loading staff accounts...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(staffResponse?.data || []).map((staff) => (
                    <tr key={staff._id}>
                      <td className="p-3">
                        <p className="font-semibold text-slate-800">{staff.name}</p>
                        <p className="text-xs text-slate-500">{staff.email}</p>
                      </td>
                      <td className="p-3 capitalize">{staff.role}</td>
                      <td className="p-3">
                        <span className={staff.isActive ? 'text-emerald-700' : 'text-slate-400'}>
                          {staff.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {staff.isActive ? (
                          <button
                            type="button"
                            onClick={() => {
                              setMessage(null);
                              deactivateStaff.reset();
                              setDialog({ kind: 'staff', id: staff._id, name: staff.name });
                            }}
                            className="text-xs font-semibold text-rose-700 hover:underline"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setMessage(null);
                              reactivateStaff.mutate(staff._id);
                            }}
                            disabled={reactivateStaff.isPending}
                            className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Archive Operational Records</h3>
            <p className="mt-1 text-xs text-slate-500">
              Archived records are hidden from normal work lists but remain in the database and linked history.
            </p>
          </div>
          <label className="text-xs font-semibold text-slate-600">
            Record category
            <select
              value={recordType}
              onChange={(event) => {
                setRecordType(event.target.value);
                setRecordPage(1);
              }}
              className="mt-1 block w-full min-w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {recordTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Record</th>
                <th className="p-3">State</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recordsLoading ? (
                <tr><td colSpan="3" className="p-5 text-center text-slate-500">Loading records...</td></tr>
              ) : (recordsResponse?.data || []).length === 0 ? (
                <tr><td colSpan="3" className="p-5 text-center text-slate-500">No records found.</td></tr>
              ) : (
                recordsResponse.data.map((record) => (
                  <tr key={record._id}>
                    <td className="p-3 font-medium text-slate-800">{record.label || record._id}</td>
                    <td className="p-3">
                      <span className={record.isArchived ? 'text-amber-700' : 'text-emerald-700'}>
                        {record.isArchived ? 'Archived' : 'Active'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setMessage(null);
                          archiveRecord.reset();
                          setDialog({
                            kind: 'record',
                            id: record._id,
                            name: record.label || 'this record',
                            isArchived: !record.isArchived,
                          });
                        }}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        {record.isArchived ? 'Restore' : 'Archive'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {recordsPagination?.total || 0} records · Page {recordsPagination?.page || 1} of {recordsPagination?.pages || 1}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={recordPage <= 1 || recordsLoading}
              onClick={() => setRecordPage((page) => Math.max(1, page - 1))}
              className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!recordsPagination || recordPage >= recordsPagination.pages || recordsLoading}
              onClick={() => setRecordPage((page) => page + 1)}
              className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
        <p className="text-xs text-amber-800">
          Invoices, payments, inventory movement history, and audit logs are intentionally protected from archiving. Use the invoice void/payment reversal workflows so financial history remains intact.
        </p>
      </section>

      {dialog && (
        <PasswordConfirmDialog
          title={dialog.kind === 'staff' ? 'Deactivate staff account?' : dialog.isArchived ? 'Archive record?' : 'Restore record?'}
          message={
            dialog.kind === 'staff'
              ? `Deactivate ${dialog.name}? Their sign-in will stop, but historical records remain.`
              : `${dialog.isArchived ? 'Archive' : 'Restore'} ${dialog.name}? Your current password is required.`
          }
          actionLabel={dialog.kind === 'staff' ? 'Deactivate' : dialog.isArchived ? 'Archive' : 'Restore'}
          error={dialogError}
          isPending={activeMutation.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={(password) => {
            if (dialog.kind === 'staff') {
              deactivateStaff.mutate({ id: dialog.id, password });
            } else if (selectedRecord) {
              archiveRecord.mutate({
                id: dialog.id,
                password,
                isArchived: dialog.isArchived,
              });
            }
          }}
        />
      )}
    </div>
  );
}
