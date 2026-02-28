import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emailTemplatesApi, settingsApi } from '../lib/api';
import { SupabaseInstance } from '../types';
import { Mail, Eye, Code, Send, RotateCcw, Save, Loader2, Globe, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';

interface EmailTemplateEditorProps {
  instance: SupabaseInstance;
}

type TemplateType = 'confirmation' | 'recovery' | 'invite' | 'magic_link' | 'email_change';

const TEMPLATE_INFO: Record<TemplateType, { label: string; description: string; icon: string }> = {
  confirmation: { label: 'Confirmation', description: 'Sent when a user signs up', icon: '✉️' },
  recovery: { label: 'Recovery', description: 'Sent for password reset', icon: '🔐' },
  invite: { label: 'Invite', description: 'Sent when inviting a user', icon: '🎉' },
  magic_link: { label: 'Magic Link', description: 'Passwordless login link', icon: '✨' },
  email_change: { label: 'Email Change', description: 'Confirm email change', icon: '📧' },
};

const VARIABLES = [
  { category: 'URLs', items: ['{{ .ConfirmationURL }}', '{{ .SiteURL }}', '{{ .RedirectTo }}'] },
  { category: 'User', items: ['{{ .Email }}', '{{ .NewEmail }}', '{{ .Data.first_name }}', '{{ .Data.last_name }}'] },
  { category: 'Security', items: ['{{ .Token }}', '{{ .TokenHash }}', '{{ .OTP }}'] },
  { category: 'Branding', items: ['{{ .Data.app_name }}', '{{ .Data.company }}', '{{ .Data.logo_url }}'] },
  { category: 'Time', items: ['{{ .ExpiresAt }}', '{{ .CreatedAt }}'] },
];

const SAMPLE_VALUES: Record<string, string> = {
  '{{ .ConfirmationURL }}': 'https://example.com/confirm?token=sample123',
  '{{ .SiteURL }}': 'https://example.com',
  '{{ .RedirectTo }}': 'https://example.com/dashboard',
  '{{ .Email }}': 'user@example.com',
  '{{ .NewEmail }}': 'newemail@example.com',
  '{{ .Token }}': '123456',
  '{{ .TokenHash }}': 'abc123def456',
  '{{ .OTP }}': '987654',
  '{{ .Data.first_name }}': 'John',
  '{{ .Data.last_name }}': 'Doe',
  '{{ .Data.app_name }}': 'My App',
  '{{ .Data.company }}': 'My Company',
  '{{ .Data.logo_url }}': 'https://example.com/logo.png',
  '{{ .ExpiresAt }}': new Date(Date.now() + 3600000).toISOString(),
  '{{ .CreatedAt }}': new Date().toISOString(),
};

export default function EmailTemplateEditor({ instance }: EmailTemplateEditorProps) {
  const [activeTemplate, setActiveTemplate] = useState<TemplateType>('confirmation');
  const [editorContent, setEditorContent] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'preview' | 'split'>('split');
  const [testEmail, setTestEmail] = useState('');
  const [showVariables, setShowVariables] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['emailTemplates', instance.name],
    queryFn: () => emailTemplatesApi.getAll(instance.name),
  });

  // Fetch global SMTP settings
  const { data: globalSmtp } = useQuery({
    queryKey: ['globalSmtp'],
    queryFn: () => settingsApi.getSmtp(),
  });

  // Update editor when template changes
  useEffect(() => {
    if (templatesData?.templates?.[activeTemplate]) {
      setEditorContent(templatesData.templates[activeTemplate].html);
      setHasChanges(false);
    }
  }, [templatesData, activeTemplate]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (htmlContent: string) => emailTemplatesApi.save(instance.name, activeTemplate, htmlContent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates', instance.name] });
      setHasChanges(false);
      toast.success(`${TEMPLATE_INFO[activeTemplate].label} template saved successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save template');
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: () => emailTemplatesApi.reset(instance.name, activeTemplate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates', instance.name] });
      toast.success('Template reset to default');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reset template');
    },
  });

  // Test email mutation
  const testMutation = useMutation({
    mutationFn: (email: string) => emailTemplatesApi.sendTest(instance.name, activeTemplate, email),
    onSuccess: (data) => {
      toast.success(
        data.usedGlobalSmtp ? `Test email sent to ${testEmail} using global SMTP` : `Test email sent to ${testEmail}`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send test email');
    },
  });

  // Generate preview HTML with variables replaced
  const previewHtml = useMemo(() => {
    let html = editorContent;
    for (const [key, value] of Object.entries(SAMPLE_VALUES)) {
      html = html.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }
    return html;
  }, [editorContent]);

  const handleEditorChange = (value: string) => {
    setEditorContent(value);
    setHasChanges(true);
  };

  const insertVariable = (variable: string) => {
    setEditorContent((prev) => prev + variable);
    setHasChanges(true);
    setShowVariables(false);
  };

  const isDefault = templatesData?.templates?.[activeTemplate]?.isDefault;

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='w-8 h-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Mail className='w-5 h-5 text-primary' />
          <h3 className='font-semibold text-lg'>Email Templates</h3>
        </div>
        {globalSmtp?.smtp_host && (
          <span className='inline-flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded-full'>
            <Globe className='w-3 h-3' />
            Global SMTP configured
          </span>
        )}
      </div>

      {/* Template Type Tabs */}
      <div className='flex gap-1 border-b border-border'>
        {Object.entries(TEMPLATE_INFO).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setActiveTemplate(key as TemplateType)}
            className={`flex items-center gap-1 px-3 py-2 text-sm border-b-2 transition-colors ${
              activeTemplate === key
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{info.icon}</span>
            <span className='hidden sm:inline'>{info.label}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className='flex flex-wrap items-center gap-2 bg-background rounded-lg border border-border p-3'>
        {/* Variable Dropdown */}
        <div className='relative'>
          <button
            onClick={() => setShowVariables(!showVariables)}
            className='flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors'
          >
            Insert Variable
            <ChevronDown className='w-3 h-3' />
          </button>
          {showVariables && (
            <div className='absolute top-full left-0 mt-1 bg-card border rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-auto'>
              {VARIABLES.map((cat) => (
                <div key={cat.category}>
                  <div className='px-3 py-1 text-xs font-medium text-muted-foreground bg-muted'>{cat.category}</div>
                  {cat.items.map((v) => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className='w-full text-left px-3 py-1.5 text-sm hover:bg-muted font-mono'
                    >
                      {v}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='flex-1' />

        {/* View Mode Toggle */}
        <div className='flex items-center border rounded-md overflow-hidden'>
          {(['code', 'split', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                viewMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {mode === 'code' ? (
                <Code className='w-4 h-4' />
              ) : mode === 'preview' ? (
                <Eye className='w-4 h-4' />
              ) : (
                'Split'
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Editor & Preview */}
      <div
        className={`grid gap-4 ${viewMode === 'split' ? 'grid-cols-2' : 'grid-cols-1'}`}
        style={{ minHeight: '500px' }}
      >
        {/* Code Editor */}
        {(viewMode === 'code' || viewMode === 'split') && (
          <div className='border rounded-lg overflow-hidden'>
            <div className='bg-muted px-3 py-2 border-b flex items-center gap-2'>
              <Code className='w-4 h-4' />
              <span className='text-sm font-medium'>HTML Editor</span>
              {hasChanges && (
                <span className='ml-auto text-xs bg-yellow-500/20 text-yellow-600 px-2 py-0.5 rounded'>Unsaved</span>
              )}
              {isDefault && (
                <span className='text-xs bg-secondary px-2 py-0.5 rounded text-muted-foreground'>Default</span>
              )}
            </div>
            <CodeMirror
              value={editorContent}
              height='450px'
              theme={oneDark}
              extensions={[html()]}
              onChange={handleEditorChange}
              className='text-sm'
            />
          </div>
        )}

        {/* Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className='border rounded-lg overflow-hidden'>
            <div className='bg-muted px-3 py-2 border-b flex items-center gap-2'>
              <Eye className='w-4 h-4' />
              <span className='text-sm font-medium'>Live Preview</span>
            </div>
            <div className='h-[450px] overflow-auto bg-[#0f172a]'>
              <iframe
                srcDoc={previewHtml}
                className='w-full h-full border-0'
                title='Email Preview'
                sandbox='allow-same-origin allow-scripts'
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className='flex flex-wrap items-center gap-3 bg-background rounded-lg border border-border p-4'>
        <button
          onClick={() => saveMutation.mutate(editorContent)}
          disabled={!hasChanges || saveMutation.isPending}
          className='flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors disabled:opacity-50'
        >
          {saveMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
          Save Template
        </button>

        <button
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending || isDefault}
          className='flex items-center gap-2 border border-border hover:bg-muted px-4 py-2 rounded-lg transition-colors disabled:opacity-50'
        >
          {resetMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <RotateCcw className='w-4 h-4' />}
          Reset to Default
        </button>

        <div className='flex-1' />

        {/* Test Email */}
        <div className='flex items-center gap-2'>
          <input
            type='email'
            placeholder='test@example.com'
            value={testEmail}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTestEmail(e.target.value)}
            className='w-48 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50'
          />
          <button
            onClick={() => testMutation.mutate(testEmail)}
            disabled={!testEmail.includes('@') || testMutation.isPending}
            className='flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg transition-colors disabled:opacity-50'
          >
            {testMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Send className='w-4 h-4' />}
            Send Test
          </button>
        </div>
      </div>
    </div>
  );
}
