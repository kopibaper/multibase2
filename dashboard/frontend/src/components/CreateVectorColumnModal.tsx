import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { vectorsApi, instancesApi } from '../lib/api';
import { X, Loader2, Plus, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface CreateVectorColumnModalProps {
  instanceName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const DIMENSION_PRESETS = [
  { label: 'OpenAI text-embedding-3-small (1536)', value: 1536 },
  { label: 'OpenAI text-embedding-3-large (3072)', value: 3072 },
  { label: 'Gemini embedding-001 (768)', value: 768 },
  { label: 'all-MiniLM-L6-v2 (384)', value: 384 },
  { label: 'Custom', value: 0 },
];

export default function CreateVectorColumnModal({ instanceName, onClose, onSuccess }: CreateVectorColumnModalProps) {
  const [tableSchema, setTableSchema] = useState('public');
  const [tableName, setTableName] = useState('');
  const [columnName, setColumnName] = useState('embedding');
  const [dimensionPreset, setDimensionPreset] = useState(1536);
  const [customDimension, setCustomDimension] = useState(1536);

  const dimension = dimensionPreset === 0 ? customDimension : dimensionPreset;

  // Fetch table list
  const { data: tables } = useQuery({
    queryKey: ['schema-tables', instanceName],
    queryFn: async () => {
      const res = await instancesApi.executeSQL(
        instanceName,
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name;`
      );
      return res.rows.map((r: any) => r.table_name as string);
    },
  });

  const addMutation = useMutation({
    mutationFn: () =>
      vectorsApi.addColumn(instanceName, {
        tableSchema,
        tableName,
        columnName,
        dimension,
      }),
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      toast.error('Failed to add vector column', { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName || !columnName || dimension < 1) {
      toast.error('Please fill in all required fields');
      return;
    }
    addMutation.mutate();
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
      <div className='bg-card border border-border rounded-lg shadow-xl w-full max-w-md'>
        <div className='flex items-center justify-between p-4 border-b border-border'>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Brain className='w-5 h-5 text-primary' />
            Add Vector Column
          </h2>
          <button onClick={onClose} className='p-1.5 hover:bg-secondary rounded-md transition-colors'>
            <X className='w-4 h-4' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-4 space-y-4'>
          {/* Table */}
          <div className='grid grid-cols-3 gap-2'>
            <div className='space-y-1.5'>
              <label className='text-sm font-medium'>Schema</label>
              <input
                type='text'
                className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                value={tableSchema}
                onChange={(e) => setTableSchema(e.target.value)}
              />
            </div>
            <div className='col-span-2 space-y-1.5'>
              <label className='text-sm font-medium'>
                Table <span className='text-destructive'>*</span>
              </label>
              {tables && tables.length > 0 ? (
                <select
                  className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  required
                >
                  <option value=''>Select table...</option>
                  {tables.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <input
                  type='text'
                  className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                  placeholder='table_name'
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  required
                />
              )}
            </div>
          </div>

          {/* Column Name */}
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>
              Column Name <span className='text-destructive'>*</span>
            </label>
            <input
              type='text'
              className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
              placeholder='embedding'
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              required
            />
          </div>

          {/* Dimension */}
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>
              Dimensions <span className='text-destructive'>*</span>
            </label>
            <select
              className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
              value={dimensionPreset}
              onChange={(e) => setDimensionPreset(parseInt(e.target.value, 10))}
            >
              {DIMENSION_PRESETS.map((p) => (
                <option key={p.label} value={p.value}>{p.label}</option>
              ))}
            </select>
            {dimensionPreset === 0 && (
              <input
                type='number'
                className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                placeholder='e.g. 1536'
                value={customDimension}
                onChange={(e) => setCustomDimension(parseInt(e.target.value, 10))}
                min={1}
                max={2000}
                required
              />
            )}
            <p className='text-xs text-muted-foreground'>
              Must match the output dimensions of your embedding model exactly.
            </p>
          </div>

          <div className='flex justify-end gap-2 pt-2 border-t border-border'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 rounded-md hover:bg-secondary transition-colors text-sm'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={addMutation.isPending}
              className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50'
            >
              {addMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Plus className='w-4 h-4' />}
              Add Column
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
