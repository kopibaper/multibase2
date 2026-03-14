import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { Globe, Github, Disc, Facebook, Twitter, Box, Mail, Shield, Loader2, Save, CheckCircle, ExternalLink, Key, Building2, Linkedin, Music, Twitch, Video, Slack, FileText, Figma, MessageSquare, Plane } from 'lucide-react';
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
  azure: Building2,
  linkedin_oidc: Linkedin,
  spotify: Music,
  twitch: Twitch,
  zoom: Video,
  slack_oidc: Slack,
  notion: FileText,
  figma: Figma,
  keycloak: Key,
  workos: Shield,
  kakao: MessageSquare,
  fly: Plane,
};

const ProviderLabels: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  discord: 'Discord',
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  apple: 'Apple',
  azure: 'Microsoft Azure',
  linkedin_oidc: 'LinkedIn',
  spotify: 'Spotify',
  twitch: 'Twitch',
  zoom: 'Zoom',
  slack_oidc: 'Slack',
  notion: 'Notion',
  figma: 'Figma',
  keycloak: 'Keycloak',
  workos: 'WorkOS',
  kakao: 'Kakao',
  fly: 'Fly.io',
};

const authProviders = [
  'google', 'github', 'discord', 'facebook', 'twitter', 'gitlab', 'bitbucket', 'apple',
  'azure', 'linkedin_oidc', 'spotify', 'twitch', 'zoom', 'slack_oidc', 'notion', 'figma',
  'keycloak', 'workos', 'kakao', 'fly',
];

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
      <div className='flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-4 border-b border-white/5 -mx-4 sm:-mx-6 px-4 sm:px-6 mb-6'>
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
                      <span className='font-medium block'>{ProviderLabels[provider] ?? provider}</span>
                      <span className='text-xs text-muted-foreground'>OAuth Provider</span>
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
                    {provider === 'keycloak' && (
                      <div className='grid gap-1.5'>
                        <label className='text-xs font-medium text-muted-foreground'>Keycloak URL</label>
                        <input
                          type='text'
                          className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                          value={getEnv(`${envPrefix}_URL`)}
                          onChange={(e) => updateEnv(`${envPrefix}_URL`, e.target.value)}
                          placeholder='https://keycloak.example.com/realms/myrealm'
                        />
                      </div>
                    )}
                    {provider === 'workos' && (
                      <div className='grid gap-1.5'>
                        <label className='text-xs font-medium text-muted-foreground'>API Key</label>
                        <input
                          type='password'
                          className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                          value={getEnv(`GOTRUE_EXTERNAL_WORKOS_API_KEY`)}
                          onChange={(e) => updateEnv(`GOTRUE_EXTERNAL_WORKOS_API_KEY`, e.target.value)}
                          placeholder='••••••••'
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

          {/* SMTP Status */}
          <div className='glass-card overflow-hidden'>
            <div className='flex items-center justify-between p-4'>
              <div className='flex items-center gap-2'>
                <Mail className='w-4 h-4 text-muted-foreground' />
                <span className='font-medium text-sm'>Custom SMTP</span>
              </div>
              {getEnv('GOTRUE_SMTP_HOST') ? (
                <div className='flex items-center gap-2'>
                  <span className='flex items-center gap-1 text-xs text-green-400'>
                    <CheckCircle className='w-3.5 h-3.5' />
                    Configured
                  </span>
                  <Link
                    to={`/workspace/projects/${instance.name}/smtp`}
                    className='flex items-center gap-1 text-xs text-brand-400 hover:underline'
                  >
                    Edit <ExternalLink className='w-3 h-3' />
                  </Link>
                </div>
              ) : (
                <Link
                  to={`/workspace/projects/${instance.name}/smtp`}
                  className='flex items-center gap-1 text-xs text-brand-400 hover:underline'
                >
                  Configure in SMTP Settings <ExternalLink className='w-3 h-3' />
                </Link>
              )}
            </div>
          </div>
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
          {getEnv('GOTRUE_EXTERNAL_PHONE_ENABLED') === 'true' && (
            <div className='mt-2 pt-3 border-t border-border/50 space-y-4 animate-in slide-in-from-top-2'>
              <div className='grid gap-1.5'>
                <label className='text-xs font-medium text-muted-foreground'>SMS Provider</label>
                <select
                  className='w-full px-3 py-2 text-sm rounded border border-input bg-background'
                  value={getEnv('GOTRUE_SMS_PROVIDER') || 'twilio'}
                  onChange={(e) => updateEnv('GOTRUE_SMS_PROVIDER', e.target.value)}
                >
                  <option value='twilio'>Twilio</option>
                  <option value='vonage'>Vonage</option>
                  <option value='messagebird'>MessageBird</option>
                </select>
              </div>

              {/* Twilio */}
              {(!getEnv('GOTRUE_SMS_PROVIDER') || getEnv('GOTRUE_SMS_PROVIDER') === 'twilio') && (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <div className='sm:col-span-2'>
                    <label className='text-xs font-medium text-muted-foreground'>Account SID</label>
                    <input
                      type='text'
                      className='w-full mt-1 px-3 py-2 text-sm rounded border border-input bg-background'
                      value={getEnv('GOTRUE_SMS_TWILIO_ACCOUNT_SID')}
                      onChange={(e) => updateEnv('GOTRUE_SMS_TWILIO_ACCOUNT_SID', e.target.value)}
                      placeholder='ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
                    />
                  </div>
                  <div>
                    <label className='text-xs font-medium text-muted-foreground'>Auth Token</label>
                    <input
                      type='password'
                      className='w-full mt-1 px-3 py-2 text-sm rounded border border-input bg-background'
                      value={getEnv('GOTRUE_SMS_TWILIO_AUTH_TOKEN')}
                      onChange={(e) => updateEnv('GOTRUE_SMS_TWILIO_AUTH_TOKEN', e.target.value)}
                      placeholder='••••••••'
                    />
                  </div>
                  <div>
                    <label className='text-xs font-medium text-muted-foreground'>Message Service SID</label>
                    <input
                      type='text'
                      className='w-full mt-1 px-3 py-2 text-sm rounded border border-input bg-background'
                      value={getEnv('GOTRUE_SMS_TWILIO_MESSAGE_SERVICE_SID')}
                      onChange={(e) => updateEnv('GOTRUE_SMS_TWILIO_MESSAGE_SERVICE_SID', e.target.value)}
                      placeholder='MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
                    />
                  </div>
                </div>
              )}

              {/* Vonage */}
              {getEnv('GOTRUE_SMS_PROVIDER') === 'vonage' && (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <div>
                    <label className='text-xs font-medium text-muted-foreground'>API Key</label>
                    <input
                      type='text'
                      className='w-full mt-1 px-3 py-2 text-sm rounded border border-input bg-background'
                      value={getEnv('GOTRUE_SMS_VONAGE_API_KEY')}
                      onChange={(e) => updateEnv('GOTRUE_SMS_VONAGE_API_KEY', e.target.value)}
                      placeholder='your-api-key'
                    />
                  </div>
                  <div>
                    <label className='text-xs font-medium text-muted-foreground'>API Secret</label>
                    <input
                      type='password'
                      className='w-full mt-1 px-3 py-2 text-sm rounded border border-input bg-background'
                      value={getEnv('GOTRUE_SMS_VONAGE_API_SECRET')}
                      onChange={(e) => updateEnv('GOTRUE_SMS_VONAGE_API_SECRET', e.target.value)}
                      placeholder='••••••••'
                    />
                  </div>
                  <div>
                    <label className='text-xs font-medium text-muted-foreground'>From Number</label>
                    <input
                      type='text'
                      className='w-full mt-1 px-3 py-2 text-sm rounded border border-input bg-background'
                      value={getEnv('GOTRUE_SMS_VONAGE_FROM')}
                      onChange={(e) => updateEnv('GOTRUE_SMS_VONAGE_FROM', e.target.value)}
                      placeholder='+15551234567'
                    />
                  </div>
                </div>
              )}

              {/* MessageBird */}
              {getEnv('GOTRUE_SMS_PROVIDER') === 'messagebird' && (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <div>
                    <label className='text-xs font-medium text-muted-foreground'>Access Key</label>
                    <input
                      type='password'
                      className='w-full mt-1 px-3 py-2 text-sm rounded border border-input bg-background'
                      value={getEnv('GOTRUE_SMS_MESSAGEBIRD_ACCESS_KEY')}
                      onChange={(e) => updateEnv('GOTRUE_SMS_MESSAGEBIRD_ACCESS_KEY', e.target.value)}
                      placeholder='••••••••'
                    />
                  </div>
                  <div>
                    <label className='text-xs font-medium text-muted-foreground'>Originator</label>
                    <input
                      type='text'
                      className='w-full mt-1 px-3 py-2 text-sm rounded border border-input bg-background'
                      value={getEnv('GOTRUE_SMS_MESSAGEBIRD_ORIGINATOR')}
                      onChange={(e) => updateEnv('GOTRUE_SMS_MESSAGEBIRD_ORIGINATOR', e.target.value)}
                      placeholder='MyApp or +15551234567'
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section 5: CAPTCHA */}
      <div className='space-y-4'>
        <div className='flex items-center gap-2 border-b border-border pb-2'>
          <Key className='w-5 h-5 text-primary' />
          <h3 className='font-semibold text-lg'>CAPTCHA</h3>
        </div>
        <div className='space-y-3 p-4 glass-card'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <label className='text-sm font-medium'>Enable CAPTCHA Protection</label>
              <p className='text-xs text-muted-foreground'>Protect sign-up and sign-in endpoints.</p>
            </div>
            <Switch
              checked={getEnv('GOTRUE_SECURITY_CAPTCHA_ENABLED') === 'true'}
              onCheckedChange={(c) => updateEnv('GOTRUE_SECURITY_CAPTCHA_ENABLED', String(c))}
            />
          </div>
          {getEnv('GOTRUE_SECURITY_CAPTCHA_ENABLED') === 'true' && (
            <div className='mt-2 pt-3 border-t border-border/50 space-y-3 animate-in slide-in-from-top-2'>
              <div>
                <label className='text-xs font-medium text-muted-foreground'>Provider</label>
                <select
                  className='w-full mt-1 px-3 py-2 text-sm rounded border border-input bg-background'
                  value={getEnv('GOTRUE_SECURITY_CAPTCHA_PROVIDER') || 'hcaptcha'}
                  onChange={(e) => updateEnv('GOTRUE_SECURITY_CAPTCHA_PROVIDER', e.target.value)}
                >
                  <option value='hcaptcha'>hCaptcha</option>
                  <option value='turnstile'>Cloudflare Turnstile</option>
                </select>
              </div>
              <div>
                <label className='text-xs font-medium text-muted-foreground'>Secret Key</label>
                <input
                  type='password'
                  className='w-full mt-1 px-3 py-2 text-sm rounded border border-input bg-background'
                  value={getEnv('GOTRUE_SECURITY_CAPTCHA_SECRET')}
                  onChange={(e) => updateEnv('GOTRUE_SECURITY_CAPTCHA_SECRET', e.target.value)}
                  placeholder='••••••••'
                />
              </div>
              <p className='text-xs text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded px-3 py-2'>
                The <strong>Site Key</strong> must be configured in your frontend application separately.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section 6: SAML SSO */}
      <div className='space-y-4'>
        <div className='flex items-center gap-2 border-b border-border pb-2'>
          <Building2 className='w-5 h-5 text-primary' />
          <h3 className='font-semibold text-lg'>SAML SSO</h3>
        </div>
        <div className='space-y-3 p-4 glass-card'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <label className='text-sm font-medium'>Enable SAML SSO</label>
              <p className='text-xs text-muted-foreground'>Enterprise Single Sign-On via SAML 2.0.</p>
            </div>
            <Switch
              checked={getEnv('GOTRUE_SAML_ENABLED') === 'true'}
              onCheckedChange={(c) => updateEnv('GOTRUE_SAML_ENABLED', String(c))}
            />
          </div>
          {getEnv('GOTRUE_SAML_ENABLED') === 'true' && (
            <div className='mt-2 pt-3 border-t border-border/50 space-y-3 animate-in slide-in-from-top-2'>
              <div>
                <label className='text-xs font-medium text-muted-foreground'>IdP Metadata URL</label>
                <input
                  type='url'
                  className='w-full mt-1 px-3 py-2 text-sm rounded border border-input bg-background'
                  value={getEnv('GOTRUE_SAML_METADATA_URL')}
                  onChange={(e) => updateEnv('GOTRUE_SAML_METADATA_URL', e.target.value)}
                  placeholder='https://your-idp.com/metadata.xml'
                />
              </div>
              <div>
                <label className='text-xs font-medium text-muted-foreground'>RSA Private Key (PEM)</label>
                <textarea
                  rows={5}
                  className='w-full mt-1 px-3 py-2 text-xs font-mono rounded border border-input bg-background resize-none'
                  value={getEnv('GOTRUE_SAML_PRIVATE_KEY')}
                  onChange={(e) => updateEnv('GOTRUE_SAML_PRIVATE_KEY', e.target.value)}
                  placeholder='-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----'
                />
              </div>
              <p className='text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded px-3 py-2'>
                Requires GoTrue v2.x with SAML support enabled.{' '}
                <a
                  href='https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-brand-400 hover:underline inline-flex items-center gap-1'
                >
                  Documentation <ExternalLink className='w-3 h-3' />
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
