import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vectorsApi } from '../lib/api';
import { Brain, Plus, Trash2, RefreshCw, Loader2, Search, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { toast } from 'sonner';
import CreateVectorColumnModal from './CreateVectorColumnModal';

interface VectorsTabProps {
  instanceName: string;
}

export default function VectorsTab({ instanceName }: VectorsTabProps) {
  const queryClient = useQueryClient();
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTable, setSearchTable] = useState('');
  const [searchColumn, setSearchColumn] = useState('');
  const [searchVectorText, setSearchVectorText] = useState('');
  const [searchK, setSearchK] = useState(5);
  const [searchMetric, setSearchMetric] = useState<'cosine' | 'l2' | 'ip'>('cosine');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  const {
    data: statusData,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['vector-status', instanceName],
    queryFn: () => vectorsApi.getStatus(instanceName),
  });

  const { data: columnsData, isLoading: isLoadingColumns, refetch: refetchColumns } = useQuery({
    queryKey: ['vector-columns', instanceName],
    queryFn: () => vectorsApi.listColumns(instanceName),
    enabled: statusData?.enabled === true,
  });

  const { data: indexesData, isLoading: isLoadingIndexes, refetch: refetchIndexes } = useQuery({
    queryKey: ['vector-indexes', instanceName],
    queryFn: () => vectorsApi.listIndexes(instanceName),
    enabled: statusData?.enabled === true,
  });

  const enableMutation = useMutation({
    mutationFn: () => vectorsApi.enable(instanceName),
    onSuccess: () => {
      toast.success('pgvector extension enabled');
      queryClient.invalidateQueries({ queryKey: ['vector-status', instanceName] });
      queryClient.invalidateQueries({ queryKey: ['vector-columns', instanceName] });
    },
    onError: (error: any) => toast.error('Failed to enable pgvector', { description: error.message }),
  });

  const dropIndexMutation = useMutation({
    mutationFn: (indexName: string) => vectorsApi.dropIndex(instanceName, indexName),
    onSuccess: () => {
      toast.success('Index dropped');
      queryClient.invalidateQueries({ queryKey: ['vector-indexes', instanceName] });
    },
    onError: (error: any) => toast.error('Failed to drop index', { description: error.message }),
  });

  const searchMutation = useMutation({
    mutationFn: () => {
      let vector: number[];
      try {
        vector = JSON.parse(searchVectorText);
        if (!Array.isArray(vector)) throw new Error();
      } catch {
        throw new Error('Vector must be a valid JSON array of numbers, e.g. [0.1, 0.2, 0.3]');
      }
      return vectorsApi.search(instanceName, {
        tableName: searchTable,
        columnName: searchColumn,
        vector,
        k: searchK,
        metric: searchMetric,
      });
    },
    onSuccess: (data) => {
      setSearchResults(data.results);
      toast.success(`Found ${data.results.length} results`);
    },
    onError: (error: any) => toast.error('Search failed', { description: error.message }),
  });

  const refetchAll = () => {
    refetchStatus();
    refetchColumns();
    refetchIndexes();
  };

  const isLoading = isLoadingStatus;
  const isEnabled = statusData?.enabled === true;
  const columns = columnsData?.columns ?? [];
  const indexes = indexesData?.indexes ?? [];

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold flex items-center gap-2'>
            <Brain className='w-5 h-5 text-primary' />
            AI Vectors (pgvector)
          </h3>
          <p className='text-sm text-muted-foreground mt-0.5'>
            Store and search high-dimensional vector embeddings for AI applications.
          </p>
        </div>
        <button
          onClick={refetchAll}
          className='p-2 hover:bg-secondary rounded-md transition-colors'
          title='Refresh'
        >
          <RefreshCw className='w-4 h-4' />
        </button>
      </div>

      {/* Extension Status Banner */}
      {isLoading ? (
        <div className='flex justify-center p-8'>
          <Loader2 className='w-6 h-6 animate-spin text-primary' />
        </div>
      ) : !isEnabled ? (
        <div className='flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg'>
          <Brain className='w-10 h-10 text-muted-foreground mb-3' />
          <p className='text-sm font-medium mb-1'>pgvector is not installed</p>
          <p className='text-xs text-muted-foreground mb-4'>
            Enable the pgvector extension to store and search vector embeddings.
          </p>
          <button
            onClick={() => enableMutation.mutate()}
            disabled={enableMutation.isPending}
            className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50'
          >
            {enableMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Zap className='w-4 h-4' />}
            Enable pgvector
          </button>
        </div>
      ) : (
        <>
          {/* Status badge */}
          <div className='flex items-center gap-2 text-sm'>
            <span className='w-2 h-2 rounded-full bg-green-500' />
            <span className='text-green-600 dark:text-green-400 font-medium'>pgvector active</span>
            {statusData?.extension?.extversion && (
              <span className='text-muted-foreground'>v{statusData.extension.extversion}</span>
            )}
          </div>

          {/* Vector Columns */}
          <div className='glass-card p-4'>
            <div className='flex items-center justify-between mb-3'>
              <h4 className='font-medium text-sm'>Vector Columns</h4>
              <button
                onClick={() => setShowAddColumn(true)}
                className='flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs transition-colors'
              >
                <Plus className='w-3.5 h-3.5' />
                Add Column
              </button>
            </div>

            {isLoadingColumns ? (
              <div className='flex justify-center p-4'>
                <Loader2 className='w-5 h-5 animate-spin text-primary' />
              </div>
            ) : columns.length === 0 ? (
              <p className='text-sm text-muted-foreground text-center py-6'>
                No vector columns found. Add a vector column to an existing table to get started.
              </p>
            ) : (
              <div className='border border-border rounded-md overflow-hidden'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted/50 border-b border-border'>
                    <tr>
                      <th className='text-left px-3 py-2 font-medium'>Schema</th>
                      <th className='text-left px-3 py-2 font-medium'>Table</th>
                      <th className='text-left px-3 py-2 font-medium'>Column</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-border'>
                    {columns.map((col: any) => (
                      <tr
                        key={`${col.table_schema}.${col.table_name}.${col.column_name}`}
                        className='hover:bg-muted/30 cursor-pointer transition-colors'
                        onClick={() => {
                          setSearchTable(col.table_name);
                          setSearchColumn(col.column_name);
                          setShowSearch(true);
                        }}
                      >
                        <td className='px-3 py-2 text-muted-foreground'>{col.table_schema}</td>
                        <td className='px-3 py-2'>{col.table_name}</td>
                        <td className='px-3 py-2'>
                          <code className='text-xs bg-muted px-1.5 py-0.5 rounded'>{col.column_name}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Indexes */}
          <div className='glass-card p-4'>
            <h4 className='font-medium text-sm mb-3'>Vector Indexes (ivfflat / hnsw)</h4>
            {isLoadingIndexes ? (
              <div className='flex justify-center p-4'>
                <Loader2 className='w-5 h-5 animate-spin text-primary' />
              </div>
            ) : indexes.length === 0 ? (
              <p className='text-sm text-muted-foreground text-center py-4'>
                No vector indexes found. Indexes speed up similarity searches on large tables.
              </p>
            ) : (
              <div className='border border-border rounded-md overflow-hidden'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted/50 border-b border-border'>
                    <tr>
                      <th className='text-left px-3 py-2 font-medium'>Index</th>
                      <th className='text-left px-3 py-2 font-medium hidden sm:table-cell'>Table</th>
                      <th className='text-right px-3 py-2 font-medium'>Actions</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-border'>
                    {indexes.map((idx: any) => (
                      <tr key={idx.indexname} className='hover:bg-muted/30 transition-colors'>
                        <td className='px-3 py-2'>
                          <code className='text-xs'>{idx.indexname}</code>
                        </td>
                        <td className='px-3 py-2 text-muted-foreground hidden sm:table-cell'>
                          {idx.schemaname}.{idx.tablename}
                        </td>
                        <td className='px-3 py-2 text-right'>
                          <button
                            onClick={() => {
                              if (confirm(`Drop index "${idx.indexname}"?`)) {
                                dropIndexMutation.mutate(idx.indexname);
                              }
                            }}
                            disabled={dropIndexMutation.isPending}
                            className='p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors'
                          >
                            <Trash2 className='w-4 h-4' />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Similarity Search */}
          <div className='glass-card p-4'>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className='flex items-center gap-2 w-full text-left'
            >
              <Search className='w-4 h-4 text-primary' />
              <h4 className='font-medium text-sm flex-1'>Similarity Search Tester</h4>
              {showSearch ? <ChevronDown className='w-4 h-4' /> : <ChevronRight className='w-4 h-4' />}
            </button>

            {showSearch && (
              <div className='mt-4 space-y-3'>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='space-y-1.5'>
                    <label className='text-xs font-medium'>Table</label>
                    <input
                      type='text'
                      className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                      placeholder='table_name'
                      value={searchTable}
                      onChange={(e) => setSearchTable(e.target.value)}
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <label className='text-xs font-medium'>Vector Column</label>
                    <input
                      type='text'
                      className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                      placeholder='embedding'
                      value={searchColumn}
                      onChange={(e) => setSearchColumn(e.target.value)}
                    />
                  </div>
                </div>

                <div className='space-y-1.5'>
                  <label className='text-xs font-medium'>Query Vector (JSON array)</label>
                  <textarea
                    className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono resize-none'
                    rows={3}
                    placeholder='[0.1, 0.2, 0.3, ...]'
                    value={searchVectorText}
                    onChange={(e) => setSearchVectorText(e.target.value)}
                  />
                </div>

                <div className='grid grid-cols-2 gap-3'>
                  <div className='space-y-1.5'>
                    <label className='text-xs font-medium'>Results (k)</label>
                    <input
                      type='number'
                      className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                      value={searchK}
                      onChange={(e) => setSearchK(parseInt(e.target.value, 10))}
                      min={1}
                      max={100}
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <label className='text-xs font-medium'>Distance Metric</label>
                    <select
                      className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                      value={searchMetric}
                      onChange={(e) => setSearchMetric(e.target.value as 'cosine' | 'l2' | 'ip')}
                    >
                      <option value='cosine'>Cosine (⇔)</option>
                      <option value='l2'>Euclidean L2 (↔)</option>
                      <option value='ip'>Inner Product (#)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => searchMutation.mutate()}
                  disabled={searchMutation.isPending || !searchTable || !searchColumn || !searchVectorText}
                  className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50'
                >
                  {searchMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Search className='w-4 h-4' />}
                  Search
                </button>

                {searchResults !== null && (
                  <div className='mt-3'>
                    <p className='text-xs text-muted-foreground mb-2'>{searchResults.length} results</p>
                    <div className='border border-border rounded-md overflow-auto max-h-48'>
                      <pre className='p-3 text-xs font-mono'>
                        {JSON.stringify(searchResults, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {showAddColumn && (
        <CreateVectorColumnModal
          instanceName={instanceName}
          onClose={() => setShowAddColumn(false)}
          onSuccess={() => {
            setShowAddColumn(false);
            queryClient.invalidateQueries({ queryKey: ['vector-columns', instanceName] });
            toast.success('Vector column added');
          }}
        />
      )}
    </div>
  );
}
