import { LucideIcon } from 'lucide-react';

interface GaugeChartProps {
  label: string;
  value: number; // 0-100 percentage
  displayValue?: string; // Optional custom display value
  icon?: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'pink' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

const colorConfig = {
  blue: {
    gradient: ['#3b82f6', '#60a5fa', '#93c5fd'],
    glow: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))',
    text: 'text-blue-500',
    bg: 'bg-blue-500/10',
    ringBg: 'rgba(59, 130, 246, 0.1)',
  },
  green: {
    gradient: ['#10b981', '#34d399', '#6ee7b7'],
    glow: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))',
    text: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    ringBg: 'rgba(16, 185, 129, 0.1)',
  },
  purple: {
    gradient: ['#8b5cf6', '#a78bfa', '#c4b5fd'],
    glow: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))',
    text: 'text-purple-500',
    bg: 'bg-purple-500/10',
    ringBg: 'rgba(139, 92, 246, 0.1)',
  },
  orange: {
    gradient: ['#f97316', '#fb923c', '#fdba74'],
    glow: 'drop-shadow(0 0 8px rgba(249, 115, 22, 0.5))',
    text: 'text-orange-500',
    bg: 'bg-orange-500/10',
    ringBg: 'rgba(249, 115, 22, 0.1)',
  },
  cyan: {
    gradient: ['#06b6d4', '#22d3ee', '#67e8f9'],
    glow: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))',
    text: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    ringBg: 'rgba(6, 182, 212, 0.1)',
  },
  pink: {
    gradient: ['#ec4899', '#f472b6', '#f9a8d4'],
    glow: 'drop-shadow(0 0 8px rgba(236, 72, 153, 0.5))',
    text: 'text-pink-500',
    bg: 'bg-pink-500/10',
    ringBg: 'rgba(236, 72, 153, 0.1)',
  },
  yellow: {
    gradient: ['#eab308', '#facc15', '#fde047'],
    glow: 'drop-shadow(0 0 8px rgba(234, 179, 8, 0.5))',
    text: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    ringBg: 'rgba(234, 179, 8, 0.1)',
  },
  red: {
    gradient: ['#ef4444', '#f87171', '#fca5a5'],
    glow: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.5))',
    text: 'text-red-500',
    bg: 'bg-red-500/10',
    ringBg: 'rgba(239, 68, 68, 0.1)',
  },
};

const sizeConfig = {
  sm: {
    width: 100,
    height: 100,
    strokeWidth: 8,
    fontSize: 'text-lg',
    iconSize: 'w-4 h-4',
    iconPadding: 'p-1.5',
  },
  md: {
    width: 140,
    height: 140,
    strokeWidth: 10,
    fontSize: 'text-2xl',
    iconSize: 'w-5 h-5',
    iconPadding: 'p-2',
  },
  lg: {
    width: 180,
    height: 180,
    strokeWidth: 12,
    fontSize: 'text-3xl',
    iconSize: 'w-6 h-6',
    iconPadding: 'p-2.5',
  },
};

export default function GaugeChart({
  label,
  value,
  displayValue,
  icon: Icon,
  color = 'blue',
  size = 'md',
}: GaugeChartProps) {
  // Clamp value between 0-100, handle both undefined and NaN
  const safeValue = value == null || isNaN(value) ? 0 : value;
  const normalizedValue = Math.min(Math.max(safeValue, 0), 100);

  // Get dynamic color based on value if not specified
  const getAutoColor = (val: number): typeof color => {
    if (val >= 90) return 'red';
    if (val >= 75) return 'orange';
    if (val >= 50) return 'yellow';
    return 'green';
  };

  const finalColor = value > 100 ? getAutoColor(normalizedValue) : color;
  const colors = colorConfig[finalColor];
  const config = sizeConfig[size];

  // SVG circle calculations
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;

  const gradientId = `gauge-gradient-${label.replace(/\s/g, '-')}-${color}`;
  const isHighValue = normalizedValue >= 75;

  return (
    <div className='flex flex-col items-center gap-4'>
      {/* Gauge SVG */}
      <div
        className='relative transition-transform hover:scale-105 duration-300'
        style={{ width: config.width, height: config.height }}
      >
        <svg
          width={config.width}
          height={config.height}
          className='transform -rotate-90'
          viewBox={`0 0 ${config.width} ${config.height}`}
          style={{ filter: isHighValue ? colors.glow : undefined }}
        >
          <defs>
            <linearGradient id={gradientId} x1='0%' y1='0%' x2='100%' y2='0%'>
              <stop offset='0%' stopColor={colors.gradient[0]} />
              <stop offset='50%' stopColor={colors.gradient[1]} />
              <stop offset='100%' stopColor={colors.gradient[2]} />
            </linearGradient>
          </defs>

          {/* Background circle */}
          <circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            stroke={colors.ringBg}
            strokeWidth={config.strokeWidth}
            fill='none'
          />

          {/* Progress circle with gradient */}
          <circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={config.strokeWidth}
            fill='none'
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap='round'
            className='transition-all duration-700 ease-out'
          />
        </svg>

        {/* Center content */}
        {(() => {
          const parts = displayValue?.includes(' / ') ? displayValue.split(' / ') : null;
          return (
            <div className='absolute inset-0 flex flex-col items-center justify-center gap-0.5'>
              {Icon && (
                <div className={`${colors.bg} p-1.5 rounded-full backdrop-blur-sm mb-0.5`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
              )}
              {parts ? (
                <>
                  <span className={`text-2xl font-bold ${colors.text} tabular-nums leading-tight`}>{parts[0]}</span>
                  <div className='w-8 h-px bg-muted-foreground/25 my-0.5' />
                  <span className='text-xs font-medium text-muted-foreground tabular-nums leading-tight'>
                    {parts[1]}
                  </span>
                </>
              ) : (
                <span className={`text-2xl font-bold ${colors.text} tabular-nums`}>
                  {displayValue || `${normalizedValue.toFixed(0)}%`}
                </span>
              )}
            </div>
          );
        })()}

        {/* Animated pulse ring for high values */}
        {isHighValue && (
          <div
            className={`absolute inset-0 rounded-full animate-ping opacity-20`}
            style={{
              border: `2px solid ${colors.gradient[0]}`,
              animationDuration: '2s',
            }}
          />
        )}
      </div>

      {/* Label */}
      <p className='text-sm font-medium text-muted-foreground text-center'>{label}</p>
    </div>
  );
}
