import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  HardDrive,
  Server,
  Cloud,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';

// ── Types ──────────────────────────────────────────────────────────────────────

type DestinationType = 'sftp' | 's3' | 'googledrive' | 'onedrive' | 'webdav';

interface BackupDestination {
  id: string;
  name: string;
  type: DestinationType;
  enabled: boolean;
  createdAt: string;
}

interface SFTPForm {
  host: string; port: number; username: string; password: string; privateKey: string; remotePath: string;
}

interface S3Form {
  endpoint: string; region: string; accessKeyId: string; secretAccessKey: string;
  bucket: string; pathPrefix: string; forcePathStyle: boolean;
}

interface GoogleDriveForm {
  clientEmail: string; privateKey: string; folderId: string;
}

interface OneDriveForm {
  tenantId: string; clientId: string; clientSecret: string; driveId: string; folderPath: string;
}

interface WebDAVForm {
  url: string; username: string; password: string; remotePath: string;
}

type ConfigForm = SFTPForm | S3Form | GoogleDriveForm | OneDriveForm | WebDAVForm;

const emptyForms: Record<DestinationType, ConfigForm> = {
  sftp: { host: '', port: 22, username: '', password: '', privateKey: '', remotePath: '/backups' },
  s3: { endpoint: '', region: 'us-east-1', accessKeyId: '', secretAccessKey: '', bucket: '', pathPrefix: 'multibase-backups', forcePathStyle: false },
  googledrive: { clientEmail: '', privateKey: '', folderId: '' },
  onedrive: { tenantId: '', clientId: '', clientSecret: '', driveId: '', folderPath: '/Backups/multibase' },
  webdav: { url: '', username: '', password: '', remotePath: '/backups' },
};

const typeLabels: Record<DestinationType, string> = {
  sftp: 'SFTP / SSH',
  s3: 'S3-kompatibel (AWS, MinIO, B2)',
  googledrive: 'Google Drive',
  onedrive: 'OneDrive / SharePoint',
  webdav: 'WebDAV (Nextcloud, Hetzner…)',
};

const typeIcons: Record<DestinationType, React.ElementType> = {
  sftp: Server,
  s3: Cloud,
  googledrive: Cloud,
  onedrive: Cloud,
  webdav: Globe,
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function BackupDestinations() {
  const { token, user } = useAuth();
  const [destinations, setDestinations] = useState<BackupDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<DestinationType>('sftp');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formConfig, setFormConfig] = useState<Record<string, any>>({ ...emptyForms.sftp });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const isAdmin = user?.role === 'admin';

  const fetchDestinations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/backup-destinations`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (res.ok) setDestinations(await res.json());
    } catch (e) {
      toast.error('Failed to load backup destinations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDestinations(); }, []);

  const openAddModal = () => {
    setEditId(null);
    setFormName('');
    setFormType('sftp');
    setFormEnabled(true);
    setFormConfig({ ...emptyForms.sftp });
    setShowModal(true);
  };

  const onTypeChange = (t: DestinationType) => {
    setFormType(t);
    setFormConfig({ ...emptyForms[t] });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name: formName, type: formType, config: formConfig, enabled: formEnabled };
      const method = editId ? 'PUT' : 'POST';
      const url = editId
        ? `${API_URL}/api/backup-destinations/${editId}`
        : `${API_URL}/api/backup-destinations`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(JSON.stringify(err.error) || 'Failed to save');
      }
      toast.success(editId ? 'Destination updated' : 'Destination created');
      setShowModal(false);
      fetchDestinations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this destination?')) return;
    try {
      await fetch(`${API_URL}/api/backup-destinations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      toast.success('Destination deleted');
      fetchDestinations();
    } catch { toast.error('Failed to delete'); }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch(`${API_URL}/api/backup-destinations/${id}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [id]: data }));
      if (data.success) toast.success('Connection successful!');
      else toast.error(`Connection failed: ${data.error}`);
    } catch { toast.error('Test request failed'); }
    finally { setTestingId(null); }
  };

  const handleToggle = async (dest: BackupDestination) => {
    try {
      await fetch(`${API_URL}/api/backup-destinations/${dest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ enabled: !dest.enabled }),
      });
      fetchDestinations();
    } catch { toast.error('Failed to toggle'); }
  };

  // ── Dynamic config fields ──

  const configField = (key: string, label: string, type = 'text', placeholder = '') => (
    <div key={key}>
      <label className='block text-sm font-medium text-foreground mb-1'>{label}</label>
      <input
        type={type}
        value={String(formConfig[key] ?? '')}
        onChange={(e) => setFormConfig((p: any) => ({ ...p, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        placeholder={placeholder}
        className='w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-sm focus:ring-2 focus:ring-primary placeholder:text-muted-foreground'
      />
    </div>
  );

  const textareaField = (key: string, label: string, placeholder = '') => (
    <div key={key}>
      <label className='block text-sm font-medium text-foreground mb-1'>{label}</label>
      <textarea
        value={String(formConfig[key] ?? '')}
        onChange={(e) => setFormConfig((p: any) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        rows={4}
        className='w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-sm font-mono focus:ring-2 focus:ring-primary placeholder:text-muted-foreground'
      />
    </div>
  );

  const renderConfigFields = () => {
    switch (formType) {
      case 'sftp':
        return (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            {configField('host', 'Host *', 'text', 'backup.example.com')}
            {configField('port', 'Port', 'number', '22')}
            {configField('username', 'Username *', 'text', 'backupuser')}
            {configField('password', 'Password', 'password', 'Leave empty if using a private key')}
            {configField('remotePath', 'Remote Path *', 'text', '/backups/multibase')}
            <div className='md:col-span-2'>{textareaField('privateKey', 'Private Key (PEM, optional)', '-----BEGIN OPENSSH PRIVATE KEY-----\n...')}</div>
          </div>
        );
      case 's3':
        return (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            {configField('endpoint', 'Endpoint URL (leave empty for AWS)', 'text', 'https://s3.example.com')}
            {configField('region', 'Region *', 'text', 'us-east-1')}
            {configField('bucket', 'Bucket Name *', 'text', 'my-backups')}
            {configField('pathPrefix', 'Path Prefix', 'text', 'multibase-backups')}
            {configField('accessKeyId', 'Access Key ID *', 'text', 'AKIAIOSFODNN7EXAMPLE')}
            {configField('secretAccessKey', 'Secret Access Key *', 'password')}
            <div className='flex items-center gap-2 md:col-span-2'>
              <input
                type='checkbox'
                id='forcePathStyle'
                checked={Boolean(formConfig['forcePathStyle'])}
                onChange={(e) => setFormConfig((p: any) => ({ ...p, forcePathStyle: e.target.checked }))}
                className='rounded'
              />
              <label htmlFor='forcePathStyle' className='text-sm text-foreground'>
                Force path-style URL (required for MinIO, Hetzner Object Storage)
              </label>
            </div>
          </div>
        );
      case 'googledrive':
        return (
          <div className='space-y-3'>
            <p className='text-xs text-muted-foreground bg-muted p-3 rounded-md'>
              Create a <strong>Service Account</strong> in Google Cloud Console, enable the Drive API, share your target folder with the service account e-mail, and paste the credentials below.
            </p>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              {configField('clientEmail', 'Service Account E-Mail *', 'email', 'backup@project.iam.gserviceaccount.com')}
              {configField('folderId', 'Target Folder ID *', 'text', 'Folder ID from the Drive URL')}
            </div>
            {textareaField('privateKey', 'Private Key (from service account JSON) *', '-----BEGIN RSA PRIVATE KEY-----\n...')}
          </div>
        );
      case 'onedrive':
        return (
          <div className='space-y-3'>
            <p className='text-xs text-muted-foreground bg-muted p-3 rounded-md'>
              Register an <strong>App Registration</strong> in Azure AD with <code>Files.ReadWrite.All</code> application permission, create a client secret, and enter the details below.
            </p>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              {configField('tenantId', 'Tenant ID *', 'text', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
              {configField('clientId', 'Client (App) ID *', 'text', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
              {configField('clientSecret', 'Client Secret *', 'password')}
              {configField('driveId', 'Drive ID (optional, for SharePoint)', 'text', 'Leave empty for personal OneDrive')}
              {configField('folderPath', 'Folder Path *', 'text', '/Backups/multibase')}
            </div>
          </div>
        );
      case 'webdav':
        return (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            {configField('url', 'WebDAV URL *', 'text', 'https://nextcloud.example.com/remote.php/dav/files/user')}
            {configField('username', 'Username *', 'text')}
            {configField('password', 'Password *', 'password')}
            {configField('remotePath', 'Remote Path *', 'text', '/backups/multibase')}
          </div>
        );
    }
  };

  const TypeIcon = formType ? typeIcons[formType] : HardDrive;

  return (
    <div className='min-h-screen bg-background'>
      <PageHeader>
        <div className='flex items-center justify-between'>
          <div>
            <Link to='/backups' className='inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2'>
              <ArrowLeft className='w-4 h-4' />
              Back to Backups
            </Link>
            <h2 className='text-2xl font-bold text-foreground flex items-center gap-2'>
              <Cloud className='w-6 h-6' />
              Backup Destinations
            </h2>
            <p className='text-muted-foreground mt-1'>
              Configure external storage targets for your backups (SFTP, S3, Google Drive, OneDrive, WebDAV)
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openAddModal}
              className='flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors'
            >
              <Plus className='w-4 h-4' />
              Add Destination
            </button>
          )}
        </div>
      </PageHeader>

      <main className='container mx-auto px-6 py-8'>
        {loading ? (
          <div className='flex items-center justify-center py-20'>
            <Loader2 className='w-8 h-8 animate-spin text-muted-foreground' />
          </div>
        ) : destinations.length === 0 ? (
          <div className='bg-card border rounded-lg p-12 text-center'>
            <Cloud className='w-12 h-12 mx-auto text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No external destinations configured</h3>
            <p className='text-muted-foreground mb-6'>
              Add an SFTP server, S3 bucket, Google Drive, OneDrive, or WebDAV endpoint to automatically
              store your backups off-site.
            </p>
            {isAdmin && (
              <button
                onClick={openAddModal}
                className='px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90'
              >
                Add First Destination
              </button>
            )}
          </div>
        ) : (
          <div className='grid gap-4'>
            {destinations.map((dest) => {
              const Icon = typeIcons[dest.type] || HardDrive;
              const result = testResults[dest.id];
              return (
                <div key={dest.id} className='bg-card border rounded-lg p-5 flex items-center gap-4'>
                  <div className='p-2 rounded-lg bg-muted'>
                    <Icon className='w-5 h-5 text-muted-foreground' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <span className='font-medium'>{dest.name}</span>
                      <span className='text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground'>
                        {typeLabels[dest.type]}
                      </span>
                      {dest.enabled ? (
                        <span className='text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200'>Enabled</span>
                      ) : (
                        <span className='text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200'>Disabled</span>
                      )}
                      {result && (
                        result.success
                          ? <span className='flex items-center gap-1 text-xs text-green-600'><CheckCircle className='w-3 h-3' /> Connected</span>
                          : <span className='flex items-center gap-1 text-xs text-red-600'><XCircle className='w-3 h-3' /> {result.error}</span>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground mt-1'>
                      Added {new Date(dest.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className='flex items-center gap-2 shrink-0'>
                      <button
                        onClick={() => handleTest(dest.id)}
                        disabled={testingId === dest.id}
                        className='p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted disabled:opacity-50'
                        title='Test connection'
                      >
                        {testingId === dest.id
                          ? <Loader2 className='w-4 h-4 animate-spin' />
                          : <RefreshCw className='w-4 h-4' />}
                      </button>
                      <button
                        onClick={() => handleToggle(dest)}
                        className={`p-2 rounded-md hover:bg-muted ${dest.enabled ? 'text-green-600' : 'text-muted-foreground'}`}
                        title={dest.enabled ? 'Disable' : 'Enable'}
                      >
                        <CheckCircle className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => handleDelete(dest.id)}
                        className='p-2 text-red-500 hover:text-red-700 rounded-md hover:bg-muted'
                        title='Delete'
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
          <div className='bg-card border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <div className='p-6 border-b'>
              <h2 className='text-xl font-semibold flex items-center gap-2'>
                <TypeIcon className='w-5 h-5' />
                {editId ? 'Edit Destination' : 'Add Backup Destination'}
              </h2>
            </div>

            <form onSubmit={handleSave} className='p-6 space-y-5'>
              {/* Name + Type */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-foreground mb-1'>
                    Name <span className='text-destructive'>*</span>
                  </label>
                  <input
                    type='text'
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder='My SFTP Server'
                    className='w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-sm focus:ring-2 focus:ring-primary'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-foreground mb-1'>
                    Type <span className='text-destructive'>*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => onTypeChange(e.target.value as DestinationType)}
                    className='w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-sm focus:ring-2 focus:ring-primary'
                  >
                    {(Object.keys(typeLabels) as DestinationType[]).map((t) => (
                      <option key={t} value={t}>{typeLabels[t]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic config fields */}
              <div className='border border-border rounded-lg p-4 bg-muted/30'>
                {renderConfigFields()}
              </div>

              {/* Enabled toggle */}
              <label className='flex items-center gap-3 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className='rounded'
                />
                <span className='text-sm text-foreground'>Enabled</span>
              </label>

              {/* Actions */}
              <div className='flex gap-3 pt-2'>
                <button
                  type='button'
                  onClick={() => setShowModal(false)}
                  className='flex-1 px-4 py-2 border rounded-md hover:bg-muted text-sm'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={saving}
                  className='flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 text-sm disabled:opacity-60 flex items-center justify-center gap-2'
                >
                  {saving && <Loader2 className='w-4 h-4 animate-spin' />}
                  {editId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
