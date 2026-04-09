import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cronApi } from '../lib/api';
import { Clock, Plus, Trash2, RefreshCw, Loader2, Play, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import CreateCronJobModal from './CreateCronJobModal';

interface CronJobsTabProps {
  instanceName: string;
}

export default function CronJobsTab({ instanceName }: CronJobsTabProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedJob, setExpandedJob] = useState<number | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['cron-jobs', instanceName],
    queryFn: () => cronApi.list(instanceName),
  });

  const { data: runsData, isLoading: isLoadingRuns } = useQuery({
    queryKey: ['cron-runs', instanceName, expandedJob],
    queryFn: () => cronApi.getRuns(instanceName, expandedJob!, 10),
    enabled: expandedJob !== null,
  });

  const deleteMutation = useMutation({
    mutationFn: (jobId: number) => cronApi.delete(instanceName, jobId),
    onSuccess: () => {
      toast.success('Cron job deleted');
      queryClient.invalidateQueries({ queryKey: ['cron-jobs', instanceName] });
    },
    onError: (error: any) => toast.error('Failed to delete job', { description: error.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ jobId, active }: { jobId: number; active: boolean }) =>
      cronApi.toggle(instanceName, jobId, active),
    onSuccess: (_, { active }) => {
      toast.success(`Job ${active ? 'activated' : 'deactivated'}`);
      queryClient.invalidateQueries({ queryKey: ['cron-jobs', instanceName] });
    },
    onError: (error: any) => toast.error('Failed to toggle job', { description: error.message }),
  });

  const runNowMutation = useMutation({
    mutationFn: (jobId: number) => cronApi.runNow(instanceName, jobId),
    onSuccess: () => {
      toast.success('Job executed successfully');
      queryClient.invalidateQueries({ queryKey: ['cron-runs', instanceName, expandedJob] });
    },
    onError: (error: any) => toast.error('Job execution failed', { description: error.message }),
  });

  const jobs = data?.jobs ?? [];
  const isEnabled = data?.enabled !== false;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold flex items-center gap-2'>
            <Clock className='w-5 h-5 text-primary' />
            Cron Jobs
          </h3>
          <p className='text-sm text-muted-foreground mt-0.5'>
            Schedule recurring SQL commands using pg_cron.
          </p>
        </div>
        <div className='flex gap-2'>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className='p-2 hover:bg-secondary rounded-md transition-colors'
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!isEnabled}
            className='flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50'
          >
            <Plus className='w-4 h-4' />
            New Job
          </button>
        </div>
      </div>

      {/* pg_cron not installed */}
      {!isLoading && !isEnabled && (
        <div className='flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg'>
          <Clock className='w-10 h-10 text-muted-foreground mb-3' />
          <p className='text-sm font-medium mb-1'>pg_cron is not installed</p>
          <p className='text-xs text-muted-foreground'>
            Enable it with:{' '}
            <code className='bg-muted px-1.5 py-0.5 rounded'>CREATE EXTENSION IF NOT EXISTS pg_cron;</code>
          </p>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className='flex justify-center p-12'>
          <Loader2 className='w-6 h-6 animate-spin text-primary' />
        </div>
      ) : isEnabled && jobs.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg'>
          <Clock className='w-10 h-10 text-muted-foreground mb-3' />
          <p className='text-sm font-medium mb-1'>No cron jobs configured</p>
          <p className='text-xs text-muted-foreground mb-4'>
            Schedule recurring SQL tasks like cleanups, aggregations, or HTTP calls.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className='flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm'
          >
            <Plus className='w-4 h-4' />
            Create First Job
          </button>
        </div>
      ) : isEnabled ? (
        <div className='border border-border rounded-lg overflow-hidden'>
          {jobs.map((job: any) => (
            <div key={job.jobid} className='border-b border-border last:border-0'>
              {/* Job Row */}
              <div className='flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors'>
                <button
                  onClick={() => setExpandedJob(expandedJob === job.jobid ? null : job.jobid)}
                  className='p-1 hover:bg-secondary rounded transition-colors flex-shrink-0'
                >
                  {expandedJob === job.jobid ? (
                    <ChevronDown className='w-4 h-4' />
                  ) : (
                    <ChevronRight className='w-4 h-4' />
                  )}
                </button>

                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 flex-wrap'>
                    <span className='font-medium text-sm'>{job.jobname}</span>
                    <code className='text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground'>
                      {job.schedule}
                    </code>
                  </div>
                  <p className='text-xs text-muted-foreground truncate mt-0.5'>{job.command}</p>
                </div>

                {/* Active toggle */}
                <button
                  onClick={() => toggleMutation.mutate({ jobId: job.jobid, active: !job.active })}
                  disabled={toggleMutation.isPending}
                  className='flex items-center gap-1.5 text-xs flex-shrink-0'
                  title={job.active ? 'Click to deactivate' : 'Click to activate'}
                >
                  {job.active ? (
                    <CheckCircle className='w-4 h-4 text-green-500' />
                  ) : (
                    <XCircle className='w-4 h-4 text-muted-foreground' />
                  )}
                  <span className='hidden sm:inline'>{job.active ? 'Active' : 'Inactive'}</span>
                </button>

                {/* Run now */}
                <button
                  onClick={() => runNowMutation.mutate(job.jobid)}
                  disabled={runNowMutation.isPending}
                  className='p-1.5 hover:bg-secondary rounded-md transition-colors flex-shrink-0'
                  title='Run now'
                >
                  {runNowMutation.isPending ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <Play className='w-4 h-4 text-primary' />
                  )}
                </button>

                {/* Delete */}
                <button
                  onClick={() => {
                    if (confirm(`Delete cron job "${job.jobname}"?`)) {
                      deleteMutation.mutate(job.jobid);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className='p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors flex-shrink-0'
                  title='Delete'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </div>

              {/* Expanded: Run History */}
              {expandedJob === job.jobid && (
                <div className='px-4 pb-3 bg-muted/20 border-t border-border'>
                  <p className='text-xs font-medium text-muted-foreground py-2'>Last runs</p>
                  {isLoadingRuns ? (
                    <div className='flex items-center gap-2 py-2'>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      <span className='text-xs text-muted-foreground'>Loading history...</span>
                    </div>
                  ) : (runsData?.runs ?? []).length === 0 ? (
                    <p className='text-xs text-muted-foreground py-1'>No runs yet.</p>
                  ) : (
                    <div className='space-y-1'>
                      {(runsData?.runs ?? []).map((run: any) => (
                        <div
                          key={run.runid}
                          className='flex items-center gap-3 text-xs py-1 border-b border-border/50 last:border-0'
                        >
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              run.status === 'succeeded' ? 'bg-green-500' : 'bg-red-500'
                            }`}
                          />
                          <span className='text-muted-foreground flex-1'>
                            {run.start_time ? new Date(run.start_time).toLocaleString() : '—'}
                          </span>
                          <span
                            className={
                              run.status === 'succeeded' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }
                          >
                            {run.status}
                          </span>
                          {run.return_message && run.status !== 'succeeded' && (
                            <span className='text-muted-foreground truncate max-w-[200px]' title={run.return_message}>
                              {run.return_message}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {showCreateModal && (
        <CreateCronJobModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(data) => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['cron-jobs', instanceName] });
            toast.success(`Job "${data.name}" created (ID: ${data.jobid})`);
          }}
          instanceName={instanceName}
        />
      )}
    </div>
  );
}
