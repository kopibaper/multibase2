import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface DataPoint {
  timestamp: string;
  [key: string]: any;
}

interface LineConfig {
  key: string;
  label: string;
  color: string;
}

interface LineChartProps {
  data: DataPoint[];
  lines: LineConfig[];
  title?: string;
  height?: number;
  xAxisFormatter?: (value: string) => string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number, name: string) => string;
  loading?: boolean;
}

const defaultXAxisFormatter = (value: string) => {
  try {
    return format(new Date(value), 'HH:mm');
  } catch {
    return value;
  }
};

const defaultYAxisFormatter = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toFixed(0);
};

const defaultTooltipFormatter = (value: number) => {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return value;
};

// Custom tooltip component with glassmorphism effect
const CustomTooltip = ({ active, payload, label, lines, tooltipFormatter }: any) => {
  if (!active || !payload?.length) return null;

  let formattedLabel = label;
  try {
    formattedLabel = format(new Date(label), 'MMM d, HH:mm:ss');
  } catch {
    // Keep original label
  }

  return (
    <div className='bg-card/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-2xl'>
      <p className='text-xs text-muted-foreground mb-2 font-medium'>{formattedLabel}</p>
      <div className='space-y-1.5'>
        {payload.map((entry: any, index: number) => {
          const lineConfig = lines.find((l: LineConfig) => l.key === entry.dataKey);
          return (
            <div key={index} className='flex items-center gap-2'>
              <div className='w-2.5 h-2.5 rounded-full shadow-sm' style={{ backgroundColor: entry.color }} />
              <span className='text-xs text-muted-foreground'>{lineConfig?.label || entry.name}:</span>
              <span className='text-sm font-semibold text-foreground'>
                {tooltipFormatter(entry.value, entry.dataKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function LineChart({
  data,
  lines,
  title,
  height = 300,
  xAxisFormatter = defaultXAxisFormatter,
  yAxisFormatter = defaultYAxisFormatter,
  tooltipFormatter = defaultTooltipFormatter,
  loading = false,
}: LineChartProps) {
  if (loading) {
    return (
      <div className='flex items-center justify-center' style={{ height }}>
        <div className='relative'>
          <div className='w-10 h-10 border-4 border-primary/30 rounded-full' />
          <div className='w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin absolute inset-0' />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center text-muted-foreground' style={{ height }}>
        <div className='w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3'>
          <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1.5}
              d='M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z'
            />
          </svg>
        </div>
        <p className='text-sm font-medium'>No data available</p>
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h3 className='text-base font-semibold mb-4 text-foreground flex items-center gap-2'>
          <div className='w-1 h-5 bg-primary rounded-full' />
          {title}
        </h3>
      )}
      <ResponsiveContainer width='100%' height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
          <defs>
            {lines.map((line) => (
              <linearGradient key={`gradient-${line.key}`} id={`gradient-${line.key}`} x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor={line.color} stopOpacity={0.3} />
                <stop offset='95%' stopColor={line.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray='3 3' stroke='currentColor' strokeOpacity={0.1} vertical={false} />
          <XAxis
            dataKey='timestamp'
            tickFormatter={xAxisFormatter}
            stroke='currentColor'
            strokeOpacity={0.3}
            tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={yAxisFormatter}
            stroke='currentColor'
            strokeOpacity={0.3}
            tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip lines={lines} tooltipFormatter={tooltipFormatter} />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            formatter={(value) => {
              const line = lines.find((l) => l.key === value);
              return <span className='text-muted-foreground'>{line?.label || value}</span>;
            }}
            iconType='circle'
            iconSize={8}
          />
          {lines.map((line) => (
            <Area
              key={line.key}
              type='monotone'
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2.5}
              fill={`url(#gradient-${line.key})`}
              name={line.key}
              dot={false}
              activeDot={{
                r: 5,
                fill: line.color,
                stroke: 'var(--card)',
                strokeWidth: 2,
              }}
              animationDuration={1000}
              animationEasing='ease-out'
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
