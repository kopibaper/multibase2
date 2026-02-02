import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { Shield, ShieldAlert, ShieldCheck, Loader2, RefreshCw, Trash2, CheckCircle, XCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import CreatePolicyModal from './CreatePolicyModal';

interface PoliciesTabProps {
  instanceName: string;
}

interface Policy {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string[];
  cmd: string;
  qual: string;
  with_check: string;
}

interface TableRLS {
  relname: string;
  relrowsecurity: boolean;
}

export default function PoliciesTab({ instanceName }: PoliciesTabProps) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch RLS Status for all tables
  const {
    data: rlsStatus,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['rls-status', instanceName],
    queryFn: async () => {
      const sql = `
        SELECT relname, relrowsecurity 
        FROM pg_class 
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE relkind = 'r' AND nspname = 'public'
        ORDER BY relname;
      `;
      const res = await instancesApi.executeSQL(instanceName, sql);
      if (res.error) throw new Error(res.error);
      return res.rows as TableRLS[];
    },
  });

  // Fetch Policies
  const {
    data: policies,
    isLoading: isLoadingPolicies,
    refetch: refetchPolicies,
  } = useQuery({
    queryKey: ['policies', instanceName],
    queryFn: async () => {
      const sql = `SELECT * FROM pg_policies WHERE schemaname = 'public';`;
      const res = await instancesApi.executeSQL(instanceName, sql);
      if (res.error) throw new Error(res.error);
      return res.rows as Policy[];
    },
  });

  // Toggle RLS Mutation
  const toggleRlsMutation = useMutation({
    mutationFn: async ({ tableName, enable }: { tableName: string; enable: boolean }) => {
      const sql = `ALTER TABLE public."${tableName}" ${enable ? 'ENABLE' : 'DISABLE'} ROW LEVEL SECURITY;`;
      return instancesApi.executeSQL(instanceName, sql);
    },
    onSuccess: (data, variables) => {
      if (data.error) {
        toast.error('Failed to update RLS', { description: data.error });
      } else {
        toast.success(`RLS ${variables.enable ? 'Enabled' : 'Disabled'} for ${variables.tableName}`);
        refetchStatus();
      }
    },
  });

  // Delete Policy Mutation
  const deletePolicyMutation = useMutation({
    mutationFn: async ({ tableName, policyName }: { tableName: string; policyName: string }) => {
      const sql = `DROP POLICY "${policyName}" ON public."${tableName}";`;
      return instancesApi.executeSQL(instanceName, sql);
    },
    onSuccess: (data) => {
      if (data.error) {
        toast.error('Failed to delete policy', { description: data.error });
      } else {
        toast.success('Policy deleted');
        refetchPolicies();
      }
    },
  });

  const isLoading = isLoadingStatus || isLoadingPolicies;

  if (isLoading) {
    return (
      <div className='flex justify-center p-12'>
        <Loader2 className='w-8 h-8 animate-spin text-primary' />
      </div>
    );
  }

  const selectedPolicies = selectedTable ? policies?.filter((p) => p.tablename === selectedTable) : [];

  return (
    <div className='flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-[800px]'>
      {/* Sidebar: Table List with RLS Status */}
      <div className='w-full lg:w-1/3 glass-card flex flex-col max-h-60 lg:max-h-none'>
        <div className='p-4 border-b border-border flex items-center justify-between'>
          <h3 className='font-semibold flex items-center gap-2'>
            <Shield className='w-4 h-4 text-primary' />
            RLS Status
          </h3>
          <button
            onClick={() => {
              refetchStatus();
              refetchPolicies();
            }}
            className='p-1.5 hover:bg-secondary rounded-md text-muted-foreground transition-colors'
          >
            <RefreshCw className='w-4 h-4' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto p-2 space-y-1'>
          {rlsStatus?.map((table) => (
            <div
              key={table.relname}
              onClick={() => setSelectedTable(table.relname)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-md text-sm transition-colors cursor-pointer border ${
                selectedTable === table.relname
                  ? 'bg-primary/5 border-primary/20'
                  : 'bg-card border-transparent hover:bg-secondary/50'
              }`}
            >
              <div className='font-medium'>{table.relname}</div>
              <div className='flex items-center gap-2'>
                {table.relrowsecurity ? (
                  <span className='flex items-center gap-1 text-xs text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full'>
                    <ShieldCheck className='w-3 h-3' /> Enabled
                  </span>
                ) : (
                  <span className='flex items-center gap-1 text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full'>
                    <ShieldAlert className='w-3 h-3' /> Disabled
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content: Policies for selected table */}
      <div className='flex-1 glass-card flex flex-col'>
        {selectedTable ? (
          <div className='flex flex-col h-full'>
            <div className='p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between'>
              <div className='min-w-0'>
                <h3 className='text-lg sm:text-xl font-bold flex items-center gap-2 truncate'>{selectedTable}</h3>
                <p className='text-sm text-muted-foreground'>Manage Row Level Security policies</p>
              </div>

              <div className='flex items-center gap-2 sm:gap-3 flex-wrap'>
                {/* RLS Toggle */}
                <div className='flex items-center gap-2 text-sm'>
                  <span className='text-muted-foreground hidden sm:inline'>RLS is:</span>
                  {rlsStatus?.find((t) => t.relname === selectedTable)?.relrowsecurity ? (
                    <button
                      onClick={() => toggleRlsMutation.mutate({ tableName: selectedTable, enable: false })}
                      disabled={toggleRlsMutation.isPending}
                      className='flex items-center gap-1 px-2 sm:px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md hover:opacity-80 transition-opacity text-xs sm:text-sm'
                    >
                      <CheckCircle className='w-3 h-3' />
                      <span className='hidden sm:inline'>Enabled</span>
                      <span className='sm:hidden'>On</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleRlsMutation.mutate({ tableName: selectedTable, enable: true })}
                      disabled={toggleRlsMutation.isPending}
                      className='flex items-center gap-1 px-2 sm:px-3 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-md hover:opacity-80 transition-opacity text-xs sm:text-sm'
                    >
                      <XCircle className='w-3 h-3' />
                      <span className='hidden sm:inline'>Disabled</span>
                      <span className='sm:hidden'>Off</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setShowCreateModal(true)}
                  className='flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm'
                >
                  <Plus className='w-4 h-4' />
                  <span className='hidden sm:inline'>New Policy</span>
                  <span className='sm:hidden'>Add</span>
                </button>
              </div>
            </div>

            <div className='flex-1 overflow-y-auto p-4 sm:p-6'>
              <h4 className='text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider'>
                Defined Policies
              </h4>

              {!selectedPolicies || selectedPolicies.length === 0 ? (
                <div className='text-center py-12 border-2 border-dashed border-border rounded-lg bg-secondary/5'>
                  <Shield className='w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-20' />
                  <p className='text-muted-foreground'>No policies defined for this table.</p>
                  <p className='text-xs text-muted-foreground mt-1'>Enable RLS and add policies to control access.</p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {selectedPolicies.map((policy) => (
                    <div
                      key={policy.policyname}
                      className='border border-border rounded-lg p-4 bg-card hover:border-primary/50 transition-colors'
                    >
                      <div className='flex items-start justify-between'>
                        <div>
                          <div className='flex items-center gap-2 mb-1'>
                            <h5 className='font-mono font-semibold text-primary'>{policy.policyname}</h5>
                            <span className='text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground'>
                              {policy.cmd}
                            </span>
                            <span className='text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground'>
                              {policy.permissive}
                            </span>
                          </div>
                          <div className='space-y-1 mt-2'>
                            <div className='text-xs text-muted-foreground'>
                              <span className='font-semibold'>Roles:</span> {policy.roles.join(', ')}
                            </div>
                            <div className='text-xs grid grid-cols-[auto_1fr] gap-2'>
                              <span className='font-semibold text-muted-foreground'>USING:</span>
                              <code className='bg-secondary/30 px-1.5 py-0.5 rounded font-mono text-foreground break-all'>
                                {policy.qual}
                              </code>
                            </div>
                            {policy.with_check && (
                              <div className='text-xs grid grid-cols-[auto_1fr] gap-2'>
                                <span className='font-semibold text-muted-foreground'>WITH CHECK:</span>
                                <code className='bg-secondary/30 px-1.5 py-0.5 rounded font-mono text-foreground break-all'>
                                  {policy.with_check}
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete policy "${policy.policyname}"?`)) {
                              deletePolicyMutation.mutate({ tableName: selectedTable, policyName: policy.policyname });
                            }
                          }}
                          className='text-muted-foreground hover:text-destructive p-2'
                          title='Delete Policy'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className='flex-1 flex flex-col items-center justify-center text-muted-foreground'>
            <Shield className='w-16 h-16 opacity-20 mb-4' />
            <p className='text-lg'>Select a table to manage policies</p>
          </div>
        )}
      </div>

      {showCreateModal && selectedTable && (
        <CreatePolicyModal
          instanceName={instanceName}
          tableName={selectedTable}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => refetchPolicies()}
        />
      )}
    </div>
  );
}
