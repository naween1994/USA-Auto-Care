import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PasswordConfirmDialog } from './PasswordConfirmDialog.jsx';

export function AdminRecordAction({ recordType, recordId, recordLabel, onArchived, compact = false }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const archiveRecord = useMutation({
    mutationFn: (password) =>
      apiRequest(`/api/admin/records/${recordType}/${recordId}/archive`, {
        method: 'PATCH',
        body: { password, isArchived: true },
      }),
    onSuccess: async () => {
      setDialogOpen(false);
      onArchived?.();
      await queryClient.invalidateQueries();
    },
  });

  if (user?.role !== 'admin') return null;

  return (
    <>
      <button
        type="button"
        title="Delete from active lists (preserve linked history)"
        aria-label={`Delete ${recordLabel || 'record'} (archive and keep history)`}
        onClick={(event) => {
          event.stopPropagation();
          archiveRecord.reset();
          setDialogOpen(true);
        }}
        className={`inline-flex items-center justify-center gap-1 rounded-md text-rose-700 hover:bg-rose-50 hover:text-rose-900 ${
          compact ? 'p-1.5' : 'px-2 py-1 text-xs font-semibold'
        }`}
      >
        <Trash2 className="h-4 w-4" />
        {!compact && <span>Delete</span>}
      </button>
      {dialogOpen && (
        <PasswordConfirmDialog
          title="Delete this record?"
          message={`Remove ${recordLabel || 'this record'} from normal work lists? Its linked service and financial history will be preserved.`}
          actionLabel="Delete Record"
          error={archiveRecord.error?.message}
          isPending={archiveRecord.isPending}
          onCancel={() => setDialogOpen(false)}
          onConfirm={(password) => archiveRecord.mutate(password)}
        />
      )}
    </>
  );
}
