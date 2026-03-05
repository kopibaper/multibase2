import { useInstanceUptime } from '../hooks/useInstances';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface UptimeChartProps {
  instanceName: string;
  className?: string;
  days?: number;
}

function getBarColor(hours: number): string {
  const pct = (hours / 24) * 100;
  if (pct >= 95) return 'bg-green-500';
  if (pct >= 75) return 'bg-yellow-400';
  if (pct >= 40) return 'bg-orange-400';
  return 'bg-red-500';
}

function getBarColorToday(hours: number): string {
  const pct = (hours / 24) * 100;
  if (pct >= 95) return 'bg-green-400';
  if (pct >= 75) return 'bg-yellow-300';
  if (pct >= 40) return 'bg-orange-300';
  return 'bg-red-400';
}

function getUptimeTextColor(pct: number): string {
  if (pct >= 95) return 'text-green-500';
  if (pct >= 75) return 'text-yellow-500';
  if (pct >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export function UptimeChart({ instanceName, className, days = 10 }: UptimeChartProps) {
  const { data: stats, isLoading } = useInstanceUptime(instanceName, days);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-4 h-[80px]', className)}>
        <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
      </div>
    );
  }

  if (!stats || stats.history.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center p-4 h-[80px] text-xs text-muted-foreground',
          className
        )}
      >
        <span>No uptime data</span>
        <span className='text-[10px] opacity-70'>Collecting data...</span>
      </div>
    );
  }

  // Take last N days only
  const lastDays = stats.history.slice(-days);
  const todayEntry = lastDays[lastDays.length - 1];
  const todayHours = todayEntry ? todayEntry.hours : 0;
  const overallPct = stats.uptimePercentage ?? 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className='flex items-center justify-between text-xs px-1'>
        <span className='text-muted-foreground'>Uptime ({days}d)</span>
        <span className={cn('font-medium', getUptimeTextColor(overallPct))}>
          {overallPct.toFixed(1)}%
        </span>
      </div>

      {/* Bar Chart — vertical bars, height = hours up that day */}
      <div className='flex items-end justify-between gap-1 h-[50px] px-1'>
        {lastDays.map((day, index) => {
          const heightPercent = (day.hours / 24) * 100;
          const isToday = index === lastDays.length - 1;
          const colorClass = isToday ? getBarColorToday(day.hours) : getBarColor(day.hours);

          return (
            <div
              key={day.date}
              className='flex-1 flex flex-col items-center gap-0.5'
              title={`${day.date}: ${day.hours}h up (${((day.hours / 24) * 100).toFixed(0)}%)`}
            >
              <div
                className={cn('w-full rounded-sm transition-all', colorClass)}
                style={{ height: `${Math.max(heightPercent, 2)}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div className='flex justify-between text-[10px] text-muted-foreground px-1'>
        <span>
          {lastDays[0]
            ? new Date(lastDays[0].date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
            : ''}
        </span>
        <span className={cn('font-medium', getUptimeTextColor((todayHours / 24) * 100))}>
          Today {todayHours}h
        </span>
      </div>
    </div>
  );
}
