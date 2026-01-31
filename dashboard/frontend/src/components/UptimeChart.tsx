import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useInstanceUptime } from '../hooks/useInstances';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface UptimeChartProps {
  instanceName: string;
  className?: string;
  days?: number;
}

export function UptimeChart({ instanceName, className, days = 30 }: UptimeChartProps) {
  const { data: stats, isLoading } = useInstanceUptime(instanceName, days);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-4 h-[100px]', className)}>
        <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
      </div>
    );
  }

  if (!stats || stats.history.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center p-4 h-[100px] text-xs text-muted-foreground',
          className
        )}
      >
        <span>No uptime data</span>
        <span className='text-[10px] opacity-70'>Collecting data...</span>
      </div>
    );
  }

  // Format data for chart
  const chartData = stats.history.map((item) => ({
    date: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    uptime: item.uptime,
    fullDate: item.date,
  }));

  const isHighUptime = stats.uptimePercentage >= 99;
  const isMediumUptime = stats.uptimePercentage >= 95 && stats.uptimePercentage < 99;

  return (
    <div className={cn('space-y-2', className)}>
      <div className='flex items-center justify-between text-xs px-1'>
        <span className='text-muted-foreground'>Uptime ({days}d)</span>
        <span
          className={cn(
            'font-medium',
            isHighUptime ? 'text-green-500' : isMediumUptime ? 'text-yellow-500' : 'text-red-500'
          )}
        >
          {stats.uptimePercentage.toFixed(2)}%
        </span>
      </div>

      <div className='h-[60px] w-full'>
        <ResponsiveContainer width='100%' height='100%'>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`gradient-${instanceName}`} x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='#10b981' stopOpacity={0.3} />
                <stop offset='95%' stopColor='#10b981' stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'hsl(var(--popover))',
                padding: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}
              itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '12px', fontWeight: '500' }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Uptime']}
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
            />
            <Area
              type='monotone'
              dataKey='uptime'
              stroke='#10b981'
              fillOpacity={1}
              fill={`url(#gradient-${instanceName})`}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
