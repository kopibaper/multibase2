import { Loader2, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmationModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  isOpen,
  onConfirm,
  onClose,
  variant = 'danger',
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
      <div className='glass-modal max-w-md w-full p-6 animate-in zoom-in-95 duration-200'>
        <div className='flex items-center gap-4 mb-4'>
          <div
            className={`p-3 rounded-full ${
              variant === 'danger'
                ? 'bg-destructive/10 text-destructive'
                : variant === 'warning'
                  ? 'bg-yellow-500/10 text-yellow-500'
                  : 'bg-primary/10 text-primary'
            }`}
          >
            <AlertTriangle className='w-6 h-6' />
          </div>
          <h3 className='text-lg font-semibold'>{title}</h3>
        </div>

        <p className='text-muted-foreground mb-6'>{message}</p>

        <div className='flex justify-end gap-3'>
          <button
            onClick={onClose}
            disabled={isLoading}
            className='px-4 py-2 rounded-md hover:bg-secondary transition-colors disabled:opacity-50'
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md text-white flex items-center gap-2 transition-colors disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-destructive hover:bg-destructive/90'
                : variant === 'warning'
                  ? 'bg-yellow-500 hover:bg-yellow-600'
                  : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {isLoading && <Loader2 className='w-4 h-4 animate-spin' />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
