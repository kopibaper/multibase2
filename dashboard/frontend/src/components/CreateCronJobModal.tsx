import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { cronApi } from '../lib/api';
import { X, Loader2, Plus, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface CreateCronJobModalProps {
  instanceName: string;
  onClose: () => void;
  onSuccess: (data: { name: string; jobid: number }) => void;
}

const SCHEDULE_PRESETS = [
  { label: 'Every minute',   value: '* * * * *' },
  { label: 'Every 5 min',    value: '*/5 * * * *' },
  { label: 'Every hour',     value: '0 * * * *' },
  { label: 'Daily at 2 am',  value: '0 2 * * *' },
  { label: 'Weekly (Mon)',   value: '0 0 * * 1' },
  { label: 'Monthly (1st)',  value: '0 0 1 * *' },
  { label: 'Custom',         value: '' },
];

export default function CreateCronJobModal({ instanceName, onClose, onSuccess }: CreateCronJobModalProps) {
  const [name, setName] = useState('');
  const [schedulePreset, setSchedulePreset] = useState(SCHEDULE_PRESETS[2].value);
  const [customSchedule, setCustomSchedule] = useState('');
  const [command, setCommand] = useState('');

  const isCustom = schedulePreset === '';
  const schedule = isCustom ? customSchedule : schedulePreset;

  const createMutation = useMutation({
    mutationFn: () => cronApi.create(instanceName, { name, schedule, command }),
    onSuccess: (data) => {
      onSuccess({ name, jobid: data.jobid });
    },
    onError: (error: any) => {
      toast.error('Failed to create cron job', { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !schedule || !command) {
      toast.error('All fields are required');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
      <div className='bg-card border border-border rounded-lg shadow-xl w-full max-w-lg'>
        {/* Header */}
        <div className='flex items-center justify-between p-4 border-b border-border'>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Clock className='w-5 h-5 text-primary' />
            Create Cron Job
          </h2>
          <button onClick={onClose} className='p-1.5 hover:bg-secondary rounded-md transition-colors'>
            <X className='w-4 h-4' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-4 space-y-4'>
          {/* Job Name */}
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>
              Job Name <span className='text-destructive'>*</span>
            </label>
            <input
              type='text'
              className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
              placeholder='e.g. cleanup-old-sessions'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Schedule */}
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>
              Schedule <span className='text-destructive'>*</span>
            </label>
            <select
              className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
              value={schedulePreset}
              onChange={(e) => setSchedulePreset(e.target.value)}
            >
              {SCHEDULE_PRESETS.map((p) => (
                <option key={p.label} value={p.value}>
                  {p.label}{p.value ? ` (${p.value})` : ''}
                </option>
              ))}
            </select>
            {isCustom && (
              <input
                type='text'
                className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono'
                placeholder='* * * * * (min hour day month weekday)'
                value={customSchedule}
                onChange={(e) => setCustomSchedule(e.target.value)}
                required
              />
            )}
            <p className='text-xs text-muted-foreground'>
              Cron syntax: minute hour day-of-month month day-of-week
            </p>
          </div>

          {/* SQL Command */}
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>
              SQL Command <span className='text-destructive'>*</span>
            </label>
            <textarea
              className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono resize-none'
              rows={4}
              placeholder={`DELETE FROM public.sessions WHERE created_at < NOW() - INTERVAL '30 days';`}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              required
            />
            <p className='text-xs text-muted-foreground'>
              Standard SQL executed on the database. You can also call stored procedures or pg_net HTTP requests.
            </p>
          </div>

          {/* Actions */}
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
              disabled={createMutation.isPending}
              className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50'
            >
              {createMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Plus className='w-4 h-4' />}
              Create Job
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
