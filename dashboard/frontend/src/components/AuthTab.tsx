import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { Globe, Github, Disc, Facebook, Twitter, Box, Mail, Shield, Loader2, Save, FileText } from 'lucide-react';
import { Switch } from './ui/Switch';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface AuthTabProps {
  instance: any;
}

// Helper for Icons
const ProviderIcons: Record<string, any> = {
  google: Globe,
  github: Github,
  discord: Disc,
  facebook: Facebook,
  twitter: Twitter,
  gitlab: Box,
  bitbucket: Box,
  apple: Box,
};

const authProviders = ['google', 'github', 'discord', 'facebook', 'twitter', 'gitlab', 'bitbucket', 'apple'];

export default function AuthTab({ instance }: AuthTabProps) {
  const queryClient = useQueryClient();
  const [env, setEnv] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Fetch Env
  const { data: fetchedEnv, isLoading } = useQuery({
    queryKey: ['instance', instance.name, 'env'],
    queryFn: () => instancesApi.getEnv(instance.name),
  });

  useEffect(() => {
    if (fetchedEnv) {
      setEnv(fetchedEnv);
    }
  }, [fetchedEnv]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) => instancesApi.updateEnv(instance.name, data),
    onSuccess: () => {
      toast.success('Auth configuration updated. Services restarting...');
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['instance', instance.name, 'env'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update auth configuration');
    },
  });

  const updateEnv = (key: string, value: string) => {
    setEnv((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const getEnv = (key: string) => env[key] || '';

  const handleSave = () => {
    // Only send relevant Auth keys to avoid overwriting everything?
    // Actually updateEnv merges, but we are editing the whole state derived from getEnv.
    // Ideally we diff, but sending the whole set we have is fine as it comes from the source.
    updateMutation.mutate(env);
  };

  if (isLoading) {
    return (
      <div className='flex justify-center p-8'>
        <Loader2 className='w-8 h-8 animate-spin text-primary' />
      </div>
    );
  }

  return (
    <div className='space-y-8 animate-in fade-in max-w-4xl mx-auto pb-12'>
      {/* Header with Save */}
      <div className='flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10 py-4 border-b mb-6'>
        <div>
          <h3 className='text-xl font-semibold'>Authentication Settings</h3>
          <p className='text-sm text-muted-foreground'>Configure GoTrue/Auth providers and security.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50'
        >
          {updateMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
          Save Changes
        </button>
      </div>

      {/* Section 1: Auth Providers */}
      <div className='space-y-4'>
        <div className='flex items-center gap-2 border-b border-border pb-2'>
          <Globe className='w-5 h-5 text-primary' />
          <h3 className='font-semibold text-lg'>OAuth Providers</h3>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {authProviders.map((provider) => {
            const Icon = ProviderIcons[provider] || Globe;
            const envPrefix = `GOTRUE_EXTERNAL_${provider.toUpperCase()}`;
            const isEnabled = getEnv(`${envPrefix}_ENABLED`) === 'true';

            return (
              <div
                key={provider}
                className={cn(
                  'border rounded-lg transition-all',
                  isEnabled ? 'bg-primary/5 border-primary/20 shadow-sm' : 'border-border bg-card'
                )}
              >
                <div className='flex items-center justify-between p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-background flex items-center justify-center border border-border shadow-sm'>
                      <Icon className='w-5 h-5 text-foreground' />
                    </div>
                    <div>
                      <span className='capitalize font-medium block'>{provider}</span>
                      <span className='text-xs text-muted-foreground'>SSO Provider</span>
                    </div>
                  </div>
                  <Switch checked={isEnabled} onCheckedChange={(c) => updateEnv(`${envPrefix}_ENABLED`, String(c))} />
                </div>
                {isEnabled && (
                  <div className='p-4 pt-0 grid gap-3 animate-in slide-in-from-top-2 border-t border-border/50 mt-2 bg-background/50 rounded-b-lg'>
                    <div className='grid gap-1.5 mt-3'>
                      <label className='text-xs font-medium text-muted-foreground'>Client ID</label>
                      <input
                        type='text'
                        className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                        value={getEnv(`${envPrefix}_CLIENT_ID`)}
                        onChange={(e) => updateEnv(`${envPrefix}_CLIENT_ID`, e.target.value)}
                        placeholder={`${provider} client id`}
                      />
                    </div>
                    <div className='grid gap-1.5'>
                      <label className='text-xs font-medium text-muted-foreground'>Client Secret</label>
                      <input
                        type='password'
                        className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                        value={getEnv(`${envPrefix}_SECRET`)}
                        onChange={(e) => updateEnv(`${envPrefix}_SECRET`, e.target.value)}
                        placeholder='••••••••'
                      />
                    </div>
                    {provider === 'google' && (
                      <div className='grid gap-1.5'>
                        <label className='text-xs font-medium text-muted-foreground'>Redirect URI (Optional)</label>
                        <input
                          type='text'
                          className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                          value={getEnv(`${envPrefix}_REDIRECT_URI`)}
                          onChange={(e) => updateEnv(`${envPrefix}_REDIRECT_URI`, e.target.value)}
                          placeholder='https://your-project.com/auth/v1/callback'
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Email & SMTP */}
      <div className='space-y-4'>
        <div className='flex items-center gap-2 border-b border-border pb-2'>
          <Mail className='w-5 h-5 text-primary' />
          <h3 className='font-semibold text-lg'>Email & SMTP</h3>
        </div>

        <div className='grid gap-6 md:grid-cols-2'>
          {/* General Email Toggles */}
          <div className='space-y-3 p-4 glass-card h-fit'>
            <h4 className='font-medium text-sm mb-2 text-muted-foreground'>General Settings</h4>
            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <label className='text-sm font-medium'>Enable Email Signup</label>
                <p className='text-xs text-muted-foreground'>Allow users to sign up with email/password.</p>
              </div>
              <Switch
                checked={getEnv('GOTRUE_EXTERNAL_EMAIL_ENABLED') !== 'false'}
                onCheckedChange={(c) => updateEnv('GOTRUE_EXTERNAL_EMAIL_ENABLED', String(c))}
              />
            </div>
            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <label className='text-sm font-medium'>Confirm Email</label>
                <p className='text-xs text-muted-foreground'>Require email confirmation before login.</p>
              </div>
              <Switch
                checked={getEnv('GOTRUE_MAILER_AUTOCONFIRM') === 'false'}
                onCheckedChange={(c) => updateEnv('GOTRUE_MAILER_AUTOCONFIRM', String(!c))}
              />
            </div>
          </div>

          {/* SMTP Config */}
          <div className='glass-card overflow-hidden'>
            <div className='flex items-center justify-between p-4 bg-secondary/10 border-b border-border'>
              <div className='flex items-center gap-2'>
                <Mail className='w-4 h-4' />
                <span className='font-medium text-sm'>Custom SMTP Settings</span>
              </div>
              <Switch
                checked={getEnv('GOTRUE_SMTP_HOST') !== ''}
                onCheckedChange={(c) => {
                  if (!c) {
                    updateEnv('GOTRUE_SMTP_HOST', '');
                  }
                }}
              />
            </div>
            {getEnv('GOTRUE_SMTP_HOST') !== '' && (
              <div className='p-4 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2'>
                <div className='col-span-2'>
                  <label className='text-xs font-medium'>Sender Email</label>
                  <input
                    type='email'
                    required
                    className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                    value={getEnv('GOTRUE_SMTP_ADMIN_EMAIL')}
                    onChange={(e) => updateEnv('GOTRUE_SMTP_ADMIN_EMAIL', e.target.value)}
                  />
                </div>
                <div className='col-span-2'>
                  <label className='text-xs font-medium'>Sender Name</label>
                  <input
                    type='text'
                    required
                    className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                    value={getEnv('GOTRUE_SMTP_SENDER_NAME')}
                    onChange={(e) => updateEnv('GOTRUE_SMTP_SENDER_NAME', e.target.value)}
                  />
                </div>
                <div>
                  <label className='text-xs font-medium'>SMTP Host</label>
                  <input
                    type='text'
                    placeholder='smtp.example.com'
                    className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                    value={getEnv('GOTRUE_SMTP_HOST')}
                    onChange={(e) => updateEnv('GOTRUE_SMTP_HOST', e.target.value)}
                  />
                </div>
                <div>
                  <label className='text-xs font-medium'>Port</label>
                  <input
                    type='number'
                    placeholder='587'
                    className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                    value={getEnv('GOTRUE_SMTP_PORT')}
                    onChange={(e) => updateEnv('GOTRUE_SMTP_PORT', e.target.value)}
                  />
                </div>
                <div>
                  <label className='text-xs font-medium'>User</label>
                  <input
                    type='text'
                    className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                    value={getEnv('GOTRUE_SMTP_USER')}
                    onChange={(e) => updateEnv('GOTRUE_SMTP_USER', e.target.value)}
                  />
                </div>
                <div>
                  <label className='text-xs font-medium'>Password</label>
                  <input
                    type='password'
                    className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                    value={getEnv('GOTRUE_SMTP_PASS')}
                    onChange={(e) => updateEnv('GOTRUE_SMTP_PASS', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Email Templates */}
      <div className='space-y-4'>
        <div className='flex items-center gap-2 border-b border-border pb-2'>
          <FileText className='w-5 h-5 text-primary' />
          <h3 className='font-semibold text-lg'>Email Templates & URLs</h3>
        </div>

        <div className='glass-card p-4 space-y-4'>
          <div className='grid gap-1.5'>
            <label className='text-sm font-medium'>Site URL</label>
            <input
              type='text'
              className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
              value={getEnv('GOTRUE_SITE_URL') || getEnv('API_EXTERNAL_URL')}
              onChange={(e) => updateEnv('GOTRUE_SITE_URL', e.target.value)}
              placeholder='https://your-app.com (Base URL for magic links)'
            />
            <p className='text-xs text-muted-foreground'>The base URL used for all link generation.</p>
          </div>

          <div className='grid md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Confirmation Mail Subject</label>
              <input
                type='text'
                className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                value={getEnv('GOTRUE_MAILER_SUBJECTS_CONFIRMATION')}
                onChange={(e) => updateEnv('GOTRUE_MAILER_SUBJECTS_CONFIRMATION', e.target.value)}
                placeholder='Confirm your Email'
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Recovery Mail Subject</label>
              <input
                type='text'
                className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                value={getEnv('GOTRUE_MAILER_SUBJECTS_RECOVERY')}
                onChange={(e) => updateEnv('GOTRUE_MAILER_SUBJECTS_RECOVERY', e.target.value)}
                placeholder='Reset your Password'
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Invite Mail Subject</label>
              <input
                type='text'
                className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                value={getEnv('GOTRUE_MAILER_SUBJECTS_INVITE')}
                onChange={(e) => updateEnv('GOTRUE_MAILER_SUBJECTS_INVITE', e.target.value)}
                placeholder='You have been invited'
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Magic Link Subject</label>
              <input
                type='text'
                className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                value={getEnv('GOTRUE_MAILER_SUBJECTS_MAGIC_LINK')}
                onChange={(e) => updateEnv('GOTRUE_MAILER_SUBJECTS_MAGIC_LINK', e.target.value)}
                placeholder='Your Magic Link'
              />
            </div>
          </div>
          <p className='text-xs text-muted-foreground'>
            Note: Advanced template content (HTML) must be configured via filesystem or environment variables directly
            if not using default.
          </p>
        </div>
      </div>

      {/* Section 4: Security */}
      <div className='space-y-4'>
        <div className='flex items-center gap-2 border-b border-border pb-2'>
          <Shield className='w-5 h-5 text-primary' />
          <h3 className='font-semibold text-lg'>Security</h3>
        </div>
        <div className='space-y-3 p-4 glass-card'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <label className='text-sm font-medium'>Enable Anonymous Signins</label>
              <p className='text-xs text-muted-foreground'>Allow temporary guest accounts.</p>
            </div>
            <Switch
              checked={getEnv('GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED') === 'true'}
              onCheckedChange={(c) => updateEnv('GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED', String(c))}
            />
          </div>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <label className='text-sm font-medium'>Enable Phone Signup</label>
              <p className='text-xs text-muted-foreground'>Requires SMS provider configuration.</p>
            </div>
            <Switch
              checked={getEnv('GOTRUE_EXTERNAL_PHONE_ENABLED') === 'true'}
              onCheckedChange={(c) => updateEnv('GOTRUE_EXTERNAL_PHONE_ENABLED', String(c))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
