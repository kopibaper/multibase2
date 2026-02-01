import { X, Loader2, Download, ExternalLink } from 'lucide-react';

interface FilePreviewModalProps {
  fileName: string;
  url: string | null;
  isLoading: boolean;
  onClose: () => void;
}

export default function FilePreviewModal({ fileName, url, isLoading, onClose }: FilePreviewModalProps) {
  if (!url && !isLoading) return null;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200'
      onClick={onClose}
    >
      <div
        className='relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center p-4'
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className='absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-10'
        >
          <X className='w-6 h-6' />
        </button>

        {isLoading ? (
          <div className='text-white flex flex-col items-center gap-4'>
            <Loader2 className='w-12 h-12 animate-spin' />
            <p>Loading preview...</p>
          </div>
        ) : (
          <div className='flex flex-col items-center gap-4 w-full'>
            <img
              src={url!}
              alt={fileName}
              className='max-h-[80vh] max-w-full rounded-lg shadow-2xl object-contain bg-checkered' // bg-checkered for transparency (needs css class or style)
              style={{
                backgroundImage: 'conic-gradient(#333 90deg, #222 90deg 180deg, #333 180deg 270deg, #222 270deg)',
                backgroundSize: '20px 20px',
              }}
            />
            <div className='flex gap-4'>
              <a
                href={url!}
                download={fileName}
                target='_blank'
                rel='noreferrer'
                className='flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-md hover:bg-white/20 transition-colors backdrop-blur-md'
              >
                <Download className='w-4 h-4' /> Download
              </a>
              <a
                href={url!}
                target='_blank'
                rel='noreferrer'
                className='flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-md hover:bg-white/20 transition-colors backdrop-blur-md'
              >
                <ExternalLink className='w-4 h-4' /> Open Original
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
