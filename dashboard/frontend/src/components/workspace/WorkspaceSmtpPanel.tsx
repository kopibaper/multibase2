import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../../lib/api';
import { Save, Loader2, Info, Mail, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { SupabaseInstance } from '../../types';
import EmailTemplateEditor from '../EmailTemplateEditor';

interface WorkspaceSmtpPanelProps {
  instance: SupabaseInstance;
}

export default function WorkspaceSmtpPanel({ instance }: WorkspaceSmtpPanelProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    smtp_host: '',
    smtp_port: 0,
    smtp_user: '',
    smtp_pass: '',
    smtp_sender_name: '',
    smtp_admin_email: '',
  });

  const [subjects, setSubjects] = useState({
    site_url: '',
    confirmation: '',
    recovery: '',
    invite: '',
    magic_link: '',
  });
  const [subjectsDirty, setSubjectsDirty] = useState(false);

  const { data: envData } = useQuery({
    queryKey: ['instance', instance.name, 'env'],
    queryFn: () => instancesApi.getEnv(instance.name),
  });

  useEffect(() => {
    if (envData) {
      setSubjects({
        site_url: envData['GOTRUE_SITE_URL'] || envData['API_EXTERNAL_URL'] || '',
        confirmation: envData['GOTRUE_MAILER_SUBJECTS_CONFIRMATION'] || '',
        recovery: envData['GOTRUE_MAILER_SUBJECTS_RECOVERY'] || '',
        invite: envData['GOTRUE_MAILER_SUBJECTS_INVITE'] || '',
        magic_link: envData['GOTRUE_MAILER_SUBJECTS_MAGIC_LINK'] || '',
      });
    }
  }, [envData]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => instancesApi.updateSmtp(instance.name, data),
    onSuccess: () => {
      toast.success('SMTP configuration updated. Auth service restarting...');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update SMTP configuration');
    },
  });

  const subjectsMutation = useMutation({
    mutationFn: (data: Record<string, string>) => instancesApi.updateEnv(instance.name, data),
    onSuccess: () => {
      toast.success('Email settings updated.');
      setSubjectsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['instance', instance.name, 'env'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update email settings');
    },
  });

  const handleSubjectChange = (key: keyof typeof subjects, value: string) => {
    setSubjects((prev) => ({ ...prev, [key]: value }));
    setSubjectsDirty(true);
  };

  const handleSubjectsSave = () => {
    subjectsMutation.mutate({
      GOTRUE_SITE_URL: subjects.site_url,
      GOTRUE_MAILER_SUBJECTS_CONFIRMATION: subjects.confirmation,
      GOTRUE_MAILER_SUBJECTS_RECOVERY: subjects.recovery,
      GOTRUE_MAILER_SUBJECTS_INVITE: subjects.invite,
      GOTRUE_MAILER_SUBJECTS_MAGIC_LINK: subjects.magic_link,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'smtp_port' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Record<string, string | number> = {};
    if (formData.smtp_host) payload.smtp_host = formData.smtp_host;
    if (formData.smtp_port) payload.smtp_port = formData.smtp_port;
    if (formData.smtp_user) payload.smtp_user = formData.smtp_user;
    if (formData.smtp_pass) payload.smtp_pass = formData.smtp_pass;
    if (formData.smtp_sender_name) payload.smtp_sender_name = formData.smtp_sender_name;
    if (formData.smtp_admin_email) payload.smtp_admin_email = formData.smtp_admin_email;

    if (Object.keys(payload).length === 0) {
      toast.info('No changes to save');
      return;
    }

    updateMutation.mutate(payload);
  };

  const inputClass =
    'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-colors';

  return (
    <>
      <div className='glass-card p-5'>
        <h3 className='text-sm font-semibold text-foreground mb-3 flex items-center gap-2'>
          <Mail className='w-4 h-4 text-orange-400' />
          SMTP Configuration
        </h3>

        <div className='bg-orange-500/5 border border-orange-500/10 rounded-lg p-3 mb-5 flex gap-3 text-xs text-muted-foreground'>
          <Info className='w-4 h-4 mt-0.5 shrink-0 text-orange-400' />
          <p>
            Set SMTP settings for this project. Leave fields blank to use global defaults.
            <br />
            <span className='text-foreground font-medium mt-1 inline-block'>Saving will restart the Auth service.</span>
          </p>
        </div>

        <form onSubmit={handleSave} className='space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>SMTP Host</label>
              <input
                type='text'
                name='smtp_host'
                value={formData.smtp_host}
                onChange={handleChange}
                placeholder='smtp.example.com'
                className={inputClass}
              />
            </div>

            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>Port</label>
              <input
                type='number'
                name='smtp_port'
                value={formData.smtp_port || ''}
                onChange={handleChange}
                placeholder='587'
                className={inputClass}
              />
            </div>

            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>Username</label>
              <input
                type='text'
                name='smtp_user'
                value={formData.smtp_user}
                onChange={handleChange}
                placeholder='user@example.com'
                className={inputClass}
              />
            </div>

            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>Password</label>
              <input
                type='password'
                name='smtp_pass'
                value={formData.smtp_pass}
                onChange={handleChange}
                placeholder='••••••••'
                className={inputClass}
              />
            </div>

            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>Sender Name</label>
              <input
                type='text'
                name='smtp_sender_name'
                value={formData.smtp_sender_name}
                onChange={handleChange}
                placeholder='My App'
                className={inputClass}
              />
            </div>

            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>Admin Email</label>
              <input
                type='email'
                name='smtp_admin_email'
                value={formData.smtp_admin_email}
                onChange={handleChange}
                placeholder='admin@example.com'
                className={inputClass}
              />
            </div>
          </div>

          <div className='pt-3 flex justify-end'>
            <button
              type='submit'
              disabled={updateMutation.isPending}
              className='flex items-center gap-2 bg-brand-500 text-white hover:bg-brand-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-[0_0_10px_rgba(62,207,142,0.3)] hover:shadow-[0_0_20px_rgba(62,207,142,0.4)]'
            >
              {updateMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
              Save SMTP Settings
            </button>
          </div>
        </form>
      </div>

      {/* Email Templates */}
      <div className='glass-card p-5 mt-4'>
        <h3 className='text-sm font-semibold text-foreground mb-4 flex items-center gap-2'>
          <FileText className='w-4 h-4 text-brand-400' />
          Email Subject Lines & URLs
        </h3>
        <div className='space-y-4'>
          <div>
            <label className='block text-xs font-medium text-muted-foreground mb-1.5'>Site URL</label>
            <input
              type='text'
              value={subjects.site_url}
              onChange={(e) => handleSubjectChange('site_url', e.target.value)}
              placeholder='https://your-app.com'
              className={inputClass}
            />
            <p className='text-xs text-muted-foreground mt-1'>Base URL used for magic links and redirects.</p>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>Confirmation Mail Subject</label>
              <input
                type='text'
                value={subjects.confirmation}
                onChange={(e) => handleSubjectChange('confirmation', e.target.value)}
                placeholder='Confirm your Email'
                className={inputClass}
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>Recovery Mail Subject</label>
              <input
                type='text'
                value={subjects.recovery}
                onChange={(e) => handleSubjectChange('recovery', e.target.value)}
                placeholder='Reset your Password'
                className={inputClass}
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>Invite Mail Subject</label>
              <input
                type='text'
                value={subjects.invite}
                onChange={(e) => handleSubjectChange('invite', e.target.value)}
                placeholder='You have been invited'
                className={inputClass}
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>Magic Link Subject</label>
              <input
                type='text'
                value={subjects.magic_link}
                onChange={(e) => handleSubjectChange('magic_link', e.target.value)}
                placeholder='Your Magic Link'
                className={inputClass}
              />
            </div>
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleSubjectsSave}
              disabled={!subjectsDirty || subjectsMutation.isPending}
              className='flex items-center gap-2 bg-brand-500 text-white hover:bg-brand-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-[0_0_10px_rgba(62,207,142,0.3)] hover:shadow-[0_0_20px_rgba(62,207,142,0.4)]'
            >
              {subjectsMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
              Save
            </button>
          </div>
        </div>
      </div>

      {/* HTML Email Templates */}
      <div className='glass-card p-5 mt-4'>
        <EmailTemplateEditor instance={instance} />
      </div>
    </>
  );
}
