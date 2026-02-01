import { Cpu, HardDrive } from 'lucide-react';
import { ResourceLimits, RESOURCE_PRESETS } from '../types';
import { cn } from '../lib/utils';

interface ResourceLimitsFormProps {
  value: ResourceLimits;
  onChange: (limits: ResourceLimits) => void;
  className?: string;
}

const PRESET_LABELS: Record<string, { label: string; description: string }> = {
  small: { label: 'Small', description: '0.5 CPU, 512 MB RAM' },
  medium: { label: 'Medium', description: '1 CPU, 1 GB RAM' },
  large: { label: 'Large', description: '2 CPU, 2 GB RAM' },
  custom: { label: 'Custom', description: 'Set your own limits' },
};

export default function ResourceLimitsForm({ value, onChange, className }: ResourceLimitsFormProps) {
  const currentPreset = value.preset || 'medium';

  const handlePresetChange = (preset: string) => {
    if (preset === 'custom') {
      onChange({ ...value, preset: 'custom' });
    } else {
      const presetConfig = RESOURCE_PRESETS[preset];
      onChange({ ...presetConfig });
    }
  };

  const handleCustomChange = (field: 'cpus' | 'memory', rawValue: string) => {
    const numValue = parseFloat(rawValue);
    onChange({
      ...value,
      preset: 'custom',
      [field]: isNaN(numValue) ? undefined : numValue,
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className='flex items-center gap-2 text-sm font-medium'>
        <Cpu className='w-4 h-4 text-primary' />
        Resource Limits
      </div>

      {/* Preset Buttons */}
      <div className='grid grid-cols-4 gap-2'>
        {Object.entries(PRESET_LABELS).map(([key, { label, description }]) => (
          <button
            key={key}
            type='button'
            onClick={() => handlePresetChange(key)}
            className={cn(
              'flex flex-col items-center p-2 rounded-lg border text-center transition-all',
              currentPreset === key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-secondary/50'
            )}
          >
            <span className='font-medium text-sm'>{label}</span>
            <span className='text-[10px] text-muted-foreground'>{description}</span>
          </button>
        ))}
      </div>

      {/* Custom Input Fields */}
      {currentPreset === 'custom' && (
        <div className='grid grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-lg border border-border animate-in fade-in slide-in-from-top-2'>
          <div>
            <label className='block text-xs font-medium mb-1.5'>
              <Cpu className='w-3 h-3 inline mr-1' />
              CPU Cores
            </label>
            <input
              type='number'
              step='0.1'
              min='0.1'
              max='16'
              value={value.cpus || ''}
              onChange={(e) => handleCustomChange('cpus', e.target.value)}
              placeholder='1.0'
              className='w-full px-3 py-2 border border-border rounded-md bg-input text-sm'
            />
            <p className='text-[10px] text-muted-foreground mt-1'>e.g., 0.5, 1, 2</p>
          </div>
          <div>
            <label className='block text-xs font-medium mb-1.5'>
              <HardDrive className='w-3 h-3 inline mr-1' />
              Memory (MB)
            </label>
            <input
              type='number'
              step='128'
              min='256'
              max='16384'
              value={value.memory || ''}
              onChange={(e) => handleCustomChange('memory', e.target.value)}
              placeholder='1024'
              className='w-full px-3 py-2 border border-border rounded-md bg-input text-sm'
            />
            <p className='text-[10px] text-muted-foreground mt-1'>e.g., 512, 1024, 2048</p>
          </div>
        </div>
      )}
    </div>
  );
}
