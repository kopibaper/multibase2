import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { X, Loader2, Save, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface EditRowModalProps {
  instanceName: string;
  tableName: string;
  row: Record<string, any>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditRowModal({ instanceName, tableName, row, onClose, onSuccess }: EditRowModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, any>>({ ...row });

  const { data: schema } = useQuery({
    queryKey: ['instance-schema', instanceName],
    queryFn: () => instancesApi.getSchema(instanceName),
    staleTime: 1000 * 60 * 5,
  });

  const columns = schema?.tables.find((t: any) => t.name === tableName)?.columns || [];
  const pkCol = columns.find((c: any) => c.is_primary_key);

  const editRowMutation = useMutation({
    mutationFn: (sql: string) => instancesApi.executeSQL(instanceName, sql),
    onSuccess: (data) => {
      if (data.error) {
        toast.error('Failed to update row', { description: data.error });
      } else {
        toast.success('Row updated successfully');
        queryClient.invalidateQueries({ queryKey: ['table-data', instanceName, tableName] });
        onSuccess();
        onClose();
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update row');
    },
  });

  const handleInputChange = (colName: string, value: string) => {
    setFormData((prev) => ({ ...prev, [colName]: value }));
  };

  const formatValue = (col: any, value: any): string => {
    if (value === null || value === undefined || String(value) === '') return 'NULL';
    const type = col.data_type || 'text';
    if (['integer', 'bigint', 'smallint', 'numeric', 'double precision', 'real'].includes(type)) {
      return String(value);
    }
    if (type === 'boolean') return String(value);
    return `'${String(value).replace(/'/g, "''")}'`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkCol) {
      toast.error('Cannot update row: No Primary Key found');
      return;
    }

    const setClauses = columns
      .filter((col: any) => col.column_name !== pkCol.column_name)
      .map((col: any) => `"${col.column_name}" = ${formatValue(col, formData[col.column_name])}`)
      .join(', ');

    if (!setClauses) {
      toast.error('Nothing to update');
      return;
    }

    const pkValue = formatValue(pkCol, row[pkCol.column_name]);
    const sql = `UPDATE public."${tableName}" SET ${setClauses} WHERE "${pkCol.column_name}" = ${pkValue};`;
    editRowMutation.mutate(sql);
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm'>
      <div className='glass-modal w-full max-w-md max-h-[70vh] flex flex-col'>
        <div className='flex items-center justify-between px-5 py-3 border-b border-border'>
          <h2 className='text-xl font-semibold flex items-center gap-2'>
            <Pencil className='w-5 h-5 text-primary' />
            Edit Row in <span className='font-mono text-primary ml-1'>{tableName}</span>
          </h2>
          <button onClick={onClose} className='text-muted-foreground hover:text-foreground'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='px-5 py-3 overflow-y-auto flex-1 space-y-3'>
          {columns.map((col: any) => {
            const isPk = col.column_name === pkCol?.column_name;
            const isIdentity =
              col.is_identity === 'YES' || (col.column_default && col.column_default.includes('nextval'));
            return (
              <div key={col.column_name}>
                <label className='block text-sm font-medium mb-1'>
                  {col.column_name}
                  <span className='ml-2 text-xs text-muted-foreground font-normal'>{col.data_type}</span>
                  {isPk && <span className='ml-2 text-xs text-primary font-normal'>(PK – read-only)</span>}
                  {isIdentity && !isPk && (
                    <span className='ml-2 text-xs text-amber-500 font-normal'>(Auto)</span>
                  )}
                </label>
                <input
                  type='text'
                  value={formData[col.column_name] ?? ''}
                  onChange={(e) => handleInputChange(col.column_name, e.target.value)}
                  disabled={isPk || isIdentity}
                  className='w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm disabled:opacity-50 disabled:cursor-not-allowed font-mono'
                />
              </div>
            );
          })}
        </form>

        <div className='px-5 py-3 border-t border-border flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground'
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={editRowMutation.isPending || !pkCol}
            className='flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50'
          >
            {editRowMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
