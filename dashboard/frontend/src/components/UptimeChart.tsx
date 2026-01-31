import { useInstanceUptime } from '../hooks/useInstances';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface UptimeChartProps {
  instanceName: string;
  className?: string;
  days?: number;
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

  // Take last 10 days only
  const last10Days = stats.history.slice(-10);

  // Calculate current uptime from services if available
  const todayHours = last10Days.length > 0 ? last10Days[last10Days.length - 1].hours : 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className='flex items-center justify-between text-xs px-1'>
        <span className='text-muted-foreground'>Uptime ({days}d)</span>
        <span className='font-medium text-green-500'>Today: {todayHours}h</span>
      </div>

      {/* Bar Chart - 10 vertical bars */}
      <div className='flex items-end justify-between gap-1 h-[50px] px-1'>
        {last10Days.map((day, index) => {
          // Height is proportional to hours (max 24h = 100%)
          const heightPercent = (day.hours / 24) * 100;
          const isToday = index === last10Days.length - 1;

          return (
            <div
              key={day.date}
              className='flex-1 flex flex-col items-center gap-0.5'
              title={`${day.date}: ${day.hours}h up`}
            >
              <div
                className={cn('w-full rounded-sm transition-all', isToday ? 'bg-green-500' : 'bg-green-500/70')}
                style={{ height: `${Math.max(heightPercent, 2)}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div className='flex justify-between text-[10px] text-muted-foreground px-1'>
        <span>{new Date(last10Days[0]?.date).toLocaleDateString(undefined, { day: 'numeric' })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
