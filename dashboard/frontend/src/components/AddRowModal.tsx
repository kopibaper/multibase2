import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { X, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface AddRowModalProps {
  instanceName: string;
  tableName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddRowModal({ instanceName, tableName, onClose, onSuccess }: AddRowModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Fetch Columns to build the form
  const { data: schema } = useQuery({
    queryKey: ['instance-schema', instanceName],
    queryFn: () => instancesApi.getSchema(instanceName),
  });

  const columns = schema?.tables.find((t: any) => t.name === tableName)?.columns || [];

  const handleInputChange = (colName: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [colName]: value,
    }));
  };

  const addRowMutation = useMutation({
    mutationFn: (sql: string) => instancesApi.executeSQL(instanceName, sql),
    onSuccess: (data) => {
      if (data.error) {
        toast.error('Failed to add row', { description: data.error });
      } else {
        toast.success(`Row added to ${tableName}`);
        queryClient.invalidateQueries({ queryKey: ['table-data', instanceName, tableName] });
        onSuccess();
        onClose();
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add row');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out empty values (let DB handles defaults/nulls)
    // Note: This logic assumes empty string = don't insert.
    // Ideally we should distinguish between "empty string" and "undefined/null".
    // For now, let's include fields that have a value in formData.
    const fields = Object.keys(formData).filter((k) => formData[k] !== undefined && formData[k] !== '');

    if (fields.length === 0) {
      toast.error('Please fill at least one field');
      return;
    }

    const cols = fields.map((f) => `"${f}"`).join(', ');
    const vals = fields
      .map((f) => {
        const val = formData[f];
        // Heuristic mapping
        // We really should check column type here. Use 'columns' prop.
        const colDef = columns.find((c: any) => c.column_name === f);
        const type = colDef?.data_type || 'text';

        if (['integer', 'bigint', 'smallint', 'numeric', 'double precision', 'real', 'boolean'].includes(type)) {
          return val; // No quotes for numbers/booleans
        }
        // for boolean, handle true/false strings? Postgres handles 'true'/'false' strings fine typically.

        // Everything else quoted
        return `'${val.replace(/'/g, "''")}'`;
      })
      .join(', ');

    const sql = `INSERT INTO public."${tableName}" (${cols}) VALUES (${vals});`;

    addRowMutation.mutate(sql);
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
      <div className='bg-card w-full max-w-lg rounded-lg border border-border shadow-xl max-h-[90vh] flex flex-col'>
        <div className='flex items-center justify-between p-6 border-b border-border'>
          <h2 className='text-xl font-semibold'>
            Add Row to <span className='font-mono text-primary'>{tableName}</span>
          </h2>
          <button onClick={onClose} className='text-muted-foreground hover:text-foreground'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6 overflow-y-auto flex-1 space-y-4'>
          {columns.map((col: any) => {
            // Skip identity/auto-increment columns usually?
            // Postgres "generated always" or "serial"
            // We can check default value provided by schema.
            const isIdentity =
              col.is_identity === 'YES' || (col.column_default && col.column_default.includes('nextval'));

            return (
              <div key={col.column_name}>
                <label className='block text-sm font-medium mb-1'>
                  {col.column_name}
                  <span className='ml-2 text-xs text-muted-foreground font-normal'>{col.data_type}</span>
                  {isIdentity && <span className='ml-2 text-xs text-amber-500 font-normal'>(Auto)</span>}
                </label>
                <input
                  type='text'
                  placeholder={col.is_nullable === 'YES' ? 'NULL' : ''}
                  onChange={(e) => handleInputChange(col.column_name, e.target.value)}
                  className='w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm'
                />
              </div>
            );
          })}
        </form>

        <div className='p-6 border-t border-border flex justify-end gap-3'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground'
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={addRowMutation.isPending}
            className='flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50'
          >
            {addRowMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
            Insert Row
          </button>
        </div>
      </div>
    </div>
  );
}
