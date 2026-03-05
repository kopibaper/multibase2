import { useInstanceUptime } from '../hooks/useInstances';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface UptimeChartProps {
  instanceName: string;
  className?: string;
  days?: number;
}

function getDayColor(hours: number): string {
  if (hours < 0) return 'bg-muted/40'; // no data
  const pct = (hours / 24) * 100;
  if (pct >= 95) return 'bg-green-500';
  if (pct >= 75) return 'bg-yellow-400';
  if (pct >= 40) return 'bg-orange-400';
  if (pct > 0)   return 'bg-red-500';
  return 'bg-red-700';
}

function getUptimeLabelColor(pct: number): string {
  if (pct >= 95) return 'text-green-500';
  if (pct >= 75) return 'text-yellow-500';
  if (pct >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export function UptimeChart({ instanceName, className, days = 10 }: UptimeChartProps) {
  const { data: stats, isLoading } = useInstanceUptime(instanceName, days);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-[52px]', className)}>
        <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
      </div>
    );
  }

  // Build a map of date → hours for quick lookup
  const historyMap = new Map<string, number>();
  stats?.history?.forEach((entry) => historyMap.set(entry.date, entry.hours));

  // Generate the last N days as slots (oldest → newest)
  const slots: { date: string; label: string; hours: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    slots.push({
      date: key,
      label: i === 0 ? 'Today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      hours: historyMap.has(key) ? historyMap.get(key)! : -1,
    });
  }

  const overallPct = stats?.uptimePercentage ?? 0;
  const todayHours = slots[slots.length - 1]?.hours ?? -1;
  const todayPct = todayHours >= 0 ? Math.round((todayHours / 24) * 100) : null;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className='flex items-center justify-between text-xs px-0.5'>
        <span className='text-muted-foreground font-medium'>Uptime</span>
        <span className={cn('font-semibold', getUptimeLabelColor(overallPct))}>
          {overallPct.toFixed(1)}%
        </span>
      </div>

      {/* Status squares grid */}
      <div className='flex items-center gap-1'>
        {slots.map((slot) => (
          <div
            key={slot.date}
            className='flex-1'
            title={
              slot.hours >= 0
                ? `${slot.label}: ${slot.hours}h up (${Math.round((slot.hours / 24) * 100)}%)`
                : `${slot.label}: no data`
            }
          >
            <div className={cn('h-5 w-full rounded-sm transition-colors', getDayColor(slot.hours))} />
          </div>
        ))}
      </div>

      {/* Footer labels */}
      <div className='flex items-center justify-between text-[10px] text-muted-foreground px-0.5'>
        <span>{slots[0]?.label}</span>
        {todayPct !== null ? (
          <span className={cn('font-medium', getUptimeLabelColor(todayPct))}>
            Today {todayPct}%
          </span>
        ) : (
          <span>Collecting...</span>
        )}
      </div>
    </div>
  );
}
