import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Key, AlertCircle, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { resetPassword } = useAuth();

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Missing reset token');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(token, password);
      setIsSuccess(true);
      toast.success('Password reset successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reset failed';
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
          <div className='w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6'>
            <CheckCircle className='w-8 h-8 text-green-500' />
          </div>
          <h2 className='text-2xl font-bold text-foreground mb-4'>Password Reset!</h2>
          <p className='text-muted-foreground mb-8'>
            Your password has been successfully updated. You can now log in with your new password.
          </p>
          <Link
            to='/login'
            className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-md hover:bg-primary/90 transition-colors'
          >
            Login Now
            <ArrowRight className='w-4 h-4' />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background flex items-center justify-center p-4'>
      <div className='max-w-md w-full'>
        <div className='text-center mb-8'>
          <h1 className='text-3xl font-bold text-foreground'>Set New Password</h1>
          <p className='text-muted-foreground mt-2'>Enter your new password below</p>
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
              <label htmlFor='password' className='block text-sm font-medium text-foreground mb-2'>
                New Password
              </label>
              <input
                id='password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className='w-full px-4 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground'
                placeholder='••••••'
                disabled={isLoading || !token}
              />
            </div>

            <div>
              <label htmlFor='confirmPassword' className='block text-sm font-medium text-foreground mb-2'>
                Confirm Password
              </label>
              <input
                id='confirmPassword'
                type='password'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className='w-full px-4 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground'
                placeholder='••••••'
                disabled={isLoading || !token}
              />
            </div>

            <button
              type='submit'
              disabled={isLoading || !token}
              className='w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isLoading ? (
                <>
                  <Loader2 className='w-5 h-5 animate-spin' />
                  Updating...
                </>
              ) : (
                <>
                  <Key className='w-5 h-5' />
                  Update Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
