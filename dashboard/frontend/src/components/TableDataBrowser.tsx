import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { Loader2, RefreshCw, Plus, Trash2, Columns, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import AddRowModal from './AddRowModal';
import AddColumnModal from './AddColumnModal';
import ConfirmationModal from './ConfirmationModal';

interface TableDataBrowserProps {
  instanceName: string;
  tableName: string;
}

export default function TableDataBrowser({ instanceName, tableName }: TableDataBrowserProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    type: 'row' | 'column' | null;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, type: null, title: '', message: '', onConfirm: () => {} });
  const pageSize = 100;

  // Generic SQL Mutation
  const sqlMutation = useMutation({
    mutationFn: (sql: string) => instancesApi.executeSQL(instanceName, sql),
    onSuccess: (data) => {
      if (data.error) {
        toast.error('Operation Failed', { description: data.error });
      } else {
        toast.success('Operation Successful');
        queryClient.invalidateQueries({ queryKey: ['table-data', instanceName, tableName] });
        queryClient.invalidateQueries({ queryKey: ['instance-schema', instanceName] });
        refetch();
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Operation Failed');
    },
  });

  const handleDeleteRow = (row: any) => {
    // Find Primary Key
    const pkCol = columns.find((c: any) => c.is_primary_key);
    if (!pkCol) {
      toast.error('Cannot delete row: No Primary Key found for this table.');
      return;
    }

    const pkValue = row[pkCol.column_name];
    setConfirmState({
      isOpen: true,
      type: 'row',
      title: 'Delete Row',
      message: `Are you sure you want to delete this row (PK: ${pkValue})? This action cannot be undone.`,
      onConfirm: () => {
        const val = typeof pkValue === 'string' ? `'${pkValue}'` : pkValue;
        const sql = `DELETE FROM public."${tableName}" WHERE "${pkCol.column_name}" = ${val};`;
        sqlMutation.mutate(sql);
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleDeleteColumn = (colName: string) => {
    setConfirmState({
      isOpen: true,
      type: 'column',
      title: 'Delete Column',
      message: `Are you sure you want to delete column "${colName}"? This implies checking dependencies and data loss.`,
      onConfirm: () => {
        const sql = `ALTER TABLE public."${tableName}" DROP COLUMN "${colName}";`;
        sqlMutation.mutate(sql);
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Fetch Table Data
  const {
    data: rows,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['table-data', instanceName, tableName, page],
    queryFn: async () => {
      const sql = `SELECT * FROM "${tableName}" LIMIT ${pageSize} OFFSET ${page * pageSize}`;
      const res = await instancesApi.executeSQL(instanceName, sql);
      if (res.error) throw new Error(res.error);
      return res.rows;
    },
  });

  // Fetch Columns for Header
  const { data: schema } = useQuery({
    queryKey: ['instance-schema', instanceName],
    queryFn: () => instancesApi.getSchema(instanceName),
    staleTime: 1000 * 60 * 5,
  });

  const columns = schema?.tables.find((t: any) => t.name === tableName)?.columns || [];

  return (
    <div className='flex flex-col h-full'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-semibold font-mono'>{tableName}</h3>
        <div className='flex gap-2'>
          <button
            onClick={() => refetch()}
            className='p-2 hover:bg-muted rounded-lg transition-colors'
            title='Refresh Data'
          >
            <RefreshCw className='w-4 h-4' />
          </button>
          <button
            onClick={() => setShowAddColumnModal(true)}
            className='p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground mr-1'
            title='Add Column'
          >
            <Columns className='w-4 h-4' />
          </button>
          <button
            onClick={() => setShowAddRowModal(true)}
            className='flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors'
          >
            <Plus className='w-4 h-4' />
            Add Row
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='w-8 h-8 animate-spin text-primary' />
        </div>
      ) : (
        <div className='border border-border rounded-lg overflow-hidden flex-1'>
          <div className='overflow-x-auto h-full'>
            <table className='w-full text-sm text-left'>
              <thead className='bg-secondary/50 border-b border-border sticky top-0'>
                <tr>
                  <th className='px-4 py-3 font-medium text-muted-foreground w-12'>#</th>
                  {columns.map((col: any) => (
                    <th
                      key={col.column_name}
                      className='px-4 py-3 font-medium text-muted-foreground whitespace-nowrap group/col'
                    >
                      <div className='flex items-center gap-2'>
                        {col.column_name}
                        <span className='text-xs opacity-50 font-normal'>{col.data_type}</span>
                        {col.is_primary_key && (
                          <span className='text-[10px] text-primary border border-primary/30 px-1 rounded'>PK</span>
                        )}
                        <button
                          onClick={() => handleDeleteColumn(col.column_name)}
                          className='opacity-50 hover:opacity-100 p-1 hover:text-destructive transition-opacity'
                          title='Delete Column'
                        >
                          <Trash2 className='w-3 h-3' />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className='px-4 py-3 w-10'></th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {rows && rows.length > 0 ? (
                  rows.map((row: any, i: number) => (
                    <tr key={i} className='hover:bg-muted/30 transition-colors group'>
                      <td className='px-4 py-2 text-muted-foreground w-12 text-xs'>{i + 1 + page * pageSize}</td>
                      {columns.map((col: any) => (
                        <td
                          key={col.column_name}
                          className='px-4 py-2 whitespace-nowrap max-w-xs truncate font-mono text-xs'
                        >
                          {formatCellValue(row[col.column_name])}
                        </td>
                      ))}
                      <td className='px-4 py-2 w-10 text-right'>
                        <button
                          onClick={() => handleDeleteRow(row)}
                          className='opacity-50 hover:opacity-100 p-1 hover:text-destructive transition-opacity'
                          title='Delete Row'
                        >
                          <Trash2 className='w-3 h-3' />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length + 2} className='px-4 py-12 text-center text-muted-foreground'>
                      No data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className='mt-2 flex justify-between items-center text-xs text-muted-foreground'>
        <span>
          Showing {rows?.length || 0} rows (Page {page + 1})
        </span>
        <div className='flex gap-2'>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className='p-1 rounded hover:bg-muted disabled:opacity-50'
            title='Previous Page'
          >
            <ChevronLeft className='w-4 h-4' />
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!rows || rows.length < pageSize}
            className='p-1 rounded hover:bg-muted disabled:opacity-50'
            title='Next Page'
          >
            <ChevronRight className='w-4 h-4' />
          </button>
        </div>
      </div>

      {showAddRowModal && (
        <AddRowModal
          instanceName={instanceName}
          tableName={tableName}
          onClose={() => setShowAddRowModal(false)}
          onSuccess={() => refetch()}
        />
      )}
      {showAddColumnModal && (
        <AddColumnModal
          instanceName={instanceName}
          tableName={tableName}
          onClose={() => setShowAddColumnModal(false)}
          onSuccess={() => {
            // We need to invalidate schema AND table data (if defaults added)
            queryClient.invalidateQueries({ queryKey: ['instance-schema', instanceName] });
            refetch();
          }}
        />
      )}

      {/* Confirmation Modal */}
      {confirmState.isOpen && (
        <ConfirmationModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmText='Delete'
          onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={confirmState.onConfirm}
          isLoading={sqlMutation.isPending}
        />
      )}
    </div>
  );
}

function formatCellValue(value: any): string {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
