import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PasswordConfirmDialog } from './PasswordConfirmDialog.jsx';

export function AdminRecordAction({ recordType, recordId, recordLabel, onDeleted, archiveOnly = false, compact = false }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const archiveRecord = useMutation({
    mutationFn: (password) => archiveOnly
      ? apiRequest(`/api/admin/records/${recordType}/${recordId}/archive`, {
          method: 'PATCH',
          body: { password, isArchived: true },
        })
      : apiRequest(`/api/admin/records/${recordType}/${recordId}`, {
          method: 'DELETE',
          body: { password },
        }),
    onSuccess: async () => {
      setDialogOpen(false);
      onDeleted?.();
      await queryClient.invalidateQueries();
    },
  });

  if (user?.role !== 'admin') return null;

  return (
    <>
      <button
        type="button"
        title={archiveOnly ? 'Archive and preserve this record' : 'Permanently delete this record'}
        aria-label={`${archiveOnly ? 'Archive' : 'Permanently delete'} ${recordLabel || 'record'}`}
        onClick={(event) => {
          event.stopPropagation();
          archiveRecord.reset();
          setDialogOpen(true);
        }}
        className={`inline-flex items-center justify-center gap-1 rounded-md text-rose-700 hover:bg-rose-50 hover:text-rose-900 ${
          compact ? 'p-1.5' : 'px-2 py-1 text-xs font-semibold'
        }`}
      >
        {archiveOnly ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        {!compact && <span>{archiveOnly ? 'Archive' : 'Delete'}</span>}
      </button>
      {dialogOpen && (
        <PasswordConfirmDialog
          title={archiveOnly ? 'Archive this record?' : 'Permanently delete this record?'}
          message={archiveOnly
            ? `Hide ${recordLabel || 'this record'} from active lists? The record remains in MongoDB and can be restored.`
            : `Permanently remove ${recordLabel || 'this record'} from MongoDB? This cannot be undone. Records linked to protected history cannot be deleted.`}
          actionLabel={archiveOnly ? 'Archive Record' : 'Delete Permanently'}
          error={archiveRecord.error?.message}
          isPending={archiveRecord.isPending}
          onCancel={() => setDialogOpen(false)}
          onConfirm={(password) => archiveRecord.mutate(password)}
        />
      )}
    </>
  );
}
