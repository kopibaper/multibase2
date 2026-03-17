import type { MarketplaceExtension } from '../../lib/api';
import { Shield, Star, Download, CheckCircle, Package } from 'lucide-react';

const CATEGORY_EMOJI: Record<string, string> = {
  database: '🗄️',
  auth: '🔐',
  functions: '⚡',
  monitoring: '📊',
  ai: '🤖',
  storage: '💾',
};

interface ExtensionCardProps {
  extension: MarketplaceExtension;
  isInstalled?: boolean;
  onInstall?: (ext: MarketplaceExtension) => void;
  onDetails?: (ext: MarketplaceExtension) => void;
}

export default function ExtensionCard({ extension, isInstalled, onInstall, onDetails }: ExtensionCardProps) {
  const emoji = CATEGORY_EMOJI[extension.category] ?? '🧩';

  return (
    <div className='glass-card p-4 flex flex-col gap-3 hover:border-white/15 transition-colors'>
      {/* Header */}
      <div className='flex items-start gap-3'>
        <div className='w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-xl flex-shrink-0 select-none'>
          {extension.iconUrl ? (
            <img src={extension.iconUrl} alt='' className='w-8 h-8 rounded-lg object-cover' />
          ) : (
            <span>{emoji}</span>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-1.5 flex-wrap'>
            <span className='text-sm font-semibold text-foreground truncate'>{extension.name}</span>
            {extension.verified && <Shield className='w-3.5 h-3.5 text-brand-400 flex-shrink-0' />}
          </div>
          <span className='text-xs text-muted-foreground'>by {extension.author}</span>
        </div>
      </div>

      {/* Description */}
      <p className='text-xs text-muted-foreground leading-relaxed line-clamp-3'>{extension.description}</p>

      {/* Tags */}
      <div className='flex flex-wrap gap-1'>
        {extension.tags
          .split(',')
          .slice(0, 4)
          .map((tag: string) => (
            <span
              key={tag}
              className='text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/5'
            >
              {tag.trim()}
            </span>
          ))}
      </div>

      {/* Footer */}
      <div className='flex items-center justify-between pt-0.5'>
        <div className='flex items-center gap-3 text-xs text-muted-foreground'>
          {extension.rating && (
            <span className='flex items-center gap-1'>
              <Star className='w-3 h-3 text-yellow-400 fill-yellow-400' />
              {extension.rating.toFixed(1)}
            </span>
          )}
          <span className='flex items-center gap-1'>
            <Download className='w-3 h-3' />
            {extension.installCount.toLocaleString()}
          </span>
          <span className='text-[10px] uppercase tracking-wide opacity-60'>v{extension.version}</span>
        </div>

        <div className='flex gap-2'>
          {onDetails && (
            <button
              onClick={() => onDetails(extension)}
              className='text-xs px-2.5 py-1 rounded border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors'
            >
              Details
            </button>
          )}
          {isInstalled ? (
            <span className='flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20'>
              <CheckCircle className='w-3 h-3' />
              Installed
            </span>
          ) : onInstall ? (
            <button
              onClick={() => onInstall(extension)}
              className='text-xs px-2.5 py-1 rounded bg-brand-500/15 text-brand-400 border border-brand-500/20 hover:bg-brand-500/25 transition-colors flex items-center gap-1'
            >
              <Package className='w-3 h-3' />
              Install
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
