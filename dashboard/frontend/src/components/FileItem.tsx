import { useState, useEffect } from 'react';
import { File as FileIcon, Download, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface FileItemProps {
  file: any;
  isPrivate: boolean; // inherited from bucket
  onPreview: (name: string) => void;
  onDownload: (name: string) => void;
  onDelete: (name: string) => void;
  getFileUrl: (name: string, isPrivate: boolean) => Promise<string | null>;
}

export default function FileItem({ file, isPrivate, onPreview, onDownload, onDelete, getFileUrl }: FileItemProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const isImage = file.metadata?.mimetype?.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);

  useEffect(() => {
    let isMounted = true;
    if (isImage) {
      getFileUrl(file.name, isPrivate).then((url) => {
        if (isMounted && url) setThumbnailUrl(url);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [file.name, isPrivate, isImage]);

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const url = await getFileUrl(file.name, isPrivate);
      if (url) {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      }
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  return (
    <div
      className='group relative flex flex-col items-center p-3 rounded-lg border border-transparent hover:border-border hover:bg-secondary/30 transition-all cursor-pointer'
      onClick={() => {
        if (isImage) {
          onPreview(file.name);
        } else {
          onDownload(file.name);
        }
      }}
    >
      <div className='w-24 h-24 mb-2 flex items-center justify-center bg-secondary/50 rounded-md text-primary overflow-hidden relative'>
        {isImage && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={file.name}
            className='w-full h-full object-cover transition-transform group-hover:scale-105'
            loading='lazy'
          />
        ) : (
          <FileIcon className='w-8 h-8' />
        )}

        {/* Overlay actions */}
        <div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm'>
          <button
            onClick={handleCopyLink}
            className='p-1.5 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors'
            title='Copy Link'
          >
            <Copy className='w-4 h-4' />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(file.name);
            }}
            className='p-1.5 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors'
            title='Download'
          >
            <Download className='w-4 h-4' />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(file.name);
            }}
            className='p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-500 transition-colors'
            title='Delete'
          >
            <Trash2 className='w-4 h-4' />
          </button>
        </div>
      </div>

      <span className='text-xs text-center truncate w-full px-1 max-w-[120px]'>{file.name}</span>
      <span className='text-[10px] text-muted-foreground'>
        {file.metadata ? (file.metadata.size / 1024).toFixed(1) + ' KB' : 'File'}
      </span>
    </div>
  );
}
