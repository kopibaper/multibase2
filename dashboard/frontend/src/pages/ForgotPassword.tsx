import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Key, AlertCircle, ArrowLeft, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const { forgotPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await forgotPassword(email);
      setIsSuccess(true);
      toast.success('Reset email sent if account exists.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center p-4'>
        <div className='max-w-md w-full bg-card border border-border rounded-lg p-8 text-center'>
          <div className='w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6'>
            <Mail className='w-8 h-8 text-blue-500' />
          </div>
          <h2 className='text-2xl font-bold text-foreground mb-4'>Check your email</h2>
          <p className='text-muted-foreground mb-8'>
            If an account exists for <strong>{email}</strong>, we've sent password reset instructions.
          </p>
          <Link to='/login' className='inline-flex items-center justify-center gap-2 text-primary hover:underline'>
            <ArrowLeft className='w-4 h-4' />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background flex items-center justify-center p-4'>
      <div className='max-w-md w-full'>
        <div className='text-center mb-8'>
          <h1 className='text-3xl font-bold text-foreground'>Reset Password</h1>
          <p className='text-muted-foreground mt-2'>Enter your email to receive a reset link</p>
        </div>

        <div className='bg-card border border-border rounded-lg p-8'>
          <form onSubmit={handleSubmit} className='space-y-6'>
            {error && (
              <div className='bg-destructive/10 border border-destructive/20 rounded-md p-4 flex items-start gap-3'>
                <AlertCircle className='w-5 h-5 text-destructive flex-shrink-0 mt-0.5' />
                <p className='text-sm text-destructive'>{error}</p>
              </div>
            )}

            <div>
              <label htmlFor='email' className='block text-sm font-medium text-foreground mb-2'>
                Email
              </label>
              <input
                id='email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className='w-full px-4 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground'
                placeholder='john@example.com'
                disabled={isLoading}
              />
            </div>

            <button
              type='submit'
              disabled={isLoading}
              className='w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isLoading ? (
                <>
                  <Loader2 className='w-5 h-5 animate-spin' />
                  Sending Link...
                </>
              ) : (
                <>
                  <Key className='w-5 h-5' />
                  Send Reset Link
                </>
              )}
            </button>
          </form>

          <div className='mt-6 pt-6 border-t border-border text-center'>
            <Link
              to='/login'
              className='text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-2'
            >
              <ArrowLeft className='w-4 h-4' />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
