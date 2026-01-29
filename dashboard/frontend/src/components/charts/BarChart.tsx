import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useState } from 'react';

interface DataPoint {
  name: string;
  [key: string]: any;
}

interface BarConfig {
  key: string;
  label: string;
  color: string;
}

interface BarChartProps {
  data: DataPoint[];
  bars: BarConfig[];
  title?: string;
  height?: number;
  yAxisLabel?: string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number, name: string) => string;
  loading?: boolean;
}

const defaultYAxisFormatter = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toFixed(0);
};

const defaultTooltipFormatter = (value: number) => {
  return value.toFixed(2);
};

// Custom tooltip with glassmorphism
const CustomTooltip = ({ active, payload, label, bars, tooltipFormatter }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className='bg-card/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-2xl'>
      <p className='text-sm font-semibold text-foreground mb-2'>{label}</p>
      <div className='space-y-1.5'>
        {payload.map((entry: any, index: number) => {
          const barConfig = bars.find((b: BarConfig) => b.key === entry.dataKey);
          return (
            <div key={index} className='flex items-center gap-2'>
              <div className='w-3 h-3 rounded shadow-sm' style={{ backgroundColor: entry.color }} />
              <span className='text-xs text-muted-foreground'>{barConfig?.label || entry.name}:</span>
              <span className='text-sm font-bold text-foreground'>{tooltipFormatter(entry.value, entry.dataKey)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function BarChart({
  data,
  bars,
  title,
  height = 300,
  yAxisLabel,
  yAxisFormatter = defaultYAxisFormatter,
  tooltipFormatter = defaultTooltipFormatter,
  loading = false,
}: BarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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
              d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
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
        <RechartsBarChart
          data={data}
          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
          onMouseMove={(state) => {
            if (state.activeTooltipIndex !== undefined) {
              setActiveIndex(state.activeTooltipIndex);
            }
          }}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <defs>
            {bars.map((bar) => (
              <linearGradient key={`gradient-${bar.key}`} id={`barGradient-${bar.key}`} x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stopColor={bar.color} stopOpacity={1} />
                <stop offset='100%' stopColor={bar.color} stopOpacity={0.6} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray='3 3' stroke='currentColor' strokeOpacity={0.1} vertical={false} />
          <XAxis
            dataKey='name'
            stroke='currentColor'
            strokeOpacity={0.3}
            tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            angle={-45}
            textAnchor='end'
            height={80}
            interval={0}
          />
          <YAxis
            tickFormatter={yAxisFormatter}
            stroke='currentColor'
            strokeOpacity={0.3}
            tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={50}
            label={
              yAxisLabel
                ? {
                    value: yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: '12px', fill: 'currentColor', opacity: 0.5 },
                  }
                : undefined
            }
          />
          <Tooltip
            content={<CustomTooltip bars={bars} tooltipFormatter={tooltipFormatter} />}
            cursor={{ fill: 'currentColor', opacity: 0.05 }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            formatter={(value) => {
              const bar = bars.find((b) => b.key === value);
              return <span className='text-muted-foreground'>{bar?.label || value}</span>;
            }}
            iconType='rect'
            iconSize={10}
          />
          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              fill={`url(#barGradient-${bar.key})`}
              name={bar.key}
              radius={[6, 6, 0, 0]}
              animationDuration={800}
              animationEasing='ease-out'
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                  style={{ transition: 'fill-opacity 0.2s ease' }}
                />
              ))}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
