import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { POSTGRES_TYPES } from '../lib/constants';
import { X, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface AddColumnModalProps {
  instanceName: string;
  tableName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddColumnModal({ instanceName, tableName, onClose, onSuccess }: AddColumnModalProps) {
  const queryClient = useQueryClient();
  const [columnName, setColumnName] = useState('');
  const [columnType, setColumnType] = useState('text');
  const [defaultValue, setDefaultValue] = useState('');
  const [isNullable, setIsNullable] = useState(true);

  const addColumnMutation = useMutation({
    mutationFn: (sql: string) => instancesApi.executeSQL(instanceName, sql),
    onSuccess: (data) => {
      if (data.error) {
        toast.error('Failed to add column', { description: data.error });
      } else {
        toast.success(`Column ${columnName} added to ${tableName}`);
        queryClient.invalidateQueries({ queryKey: ['instance-schema', instanceName] });
        onSuccess();
        onClose();
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add column');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!columnName.trim()) {
      toast.error('Column name is required');
      return;
    }

    let sql = `ALTER TABLE public."${tableName}" ADD COLUMN "${columnName}" ${columnType}`;

    if (!isNullable) {
      sql += ' NOT NULL';
      // If adding NOT NULL to existing table, we usually need a default
      if (!defaultValue) {
        // Warning: this might fail if table has rows. Postgres requires default for NOT NULL on existing rows.
        // But let's assume user knows or table is empty, or Postgres 11+ handles it better (it does for constant defaults).
      }
    }

    if (defaultValue) {
      // Simple heuristic for quoting default values
      // If defaultValue already looks like a function call (e.g. now()) or is quoted, leave it.
      // This is tricky. Let's just assume user types SQL-valid default for now, or strings.
      // For safety, let's just append it raw and expect user to quote strings if needed, OR we can try to be smart.
      // Simplest: DEFAULT value
      sql += ` DEFAULT ${defaultValue}`;
    }

    addColumnMutation.mutate(sql);
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm'>
      <div className='glass-modal w-full max-w-md'>
        <div className='flex items-center justify-between p-6 border-b border-border'>
          <h2 className='text-xl font-semibold'>
            Add Column to <span className='font-mono text-primary'>{tableName}</span>
          </h2>
          <button onClick={onClose} className='text-muted-foreground hover:text-foreground'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <div>
            <label className='block text-sm font-medium mb-2'>Column Name</label>
            <input
              type='text'
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              className='w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
              placeholder='e.g. age'
              autoFocus
            />
          </div>

          <div>
            <label className='block text-sm font-medium mb-2'>Type</label>
            <select
              value={columnType}
              onChange={(e) => setColumnType(e.target.value)}
              className='w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
            >
              {POSTGRES_TYPES.map((type) => (
                <option key={type.value} value={type.value} title={type.description}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium mb-2'>Default Value (Optional)</label>
            <input
              type='text'
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              className='w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
              placeholder="e.g. 0 or 'active' or now()"
            />
            <p className='text-xs text-muted-foreground mt-1'>
              Note: Quote strings like 'hello'. Functions like now() don't need quotes.
            </p>
          </div>

          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='isNullable'
              checked={isNullable}
              onChange={(e) => setIsNullable(e.target.checked)}
              className='rounded border-muted'
            />
            <label htmlFor='isNullable' className='text-sm cursor-pointer'>
              Nullable
            </label>
          </div>

          <div className='flex justify-end pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground mr-2'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={addColumnMutation.isPending || !columnName}
              className='flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50'
            >
              {addColumnMutation.isPending ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <Save className='w-4 h-4' />
              )}
              Add Column
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
