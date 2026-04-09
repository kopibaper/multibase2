import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  ArrowLeft,
  AlertTriangle,
  Book,
  Activity,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { useApiKeys, useCreateApiKey, useDeleteApiKey, useApiKeyStats, useApiKeyScopes } from '../hooks/useApiKeys';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import { ApiKey, ScopeGroup } from '../types';

export default function ApiKeys() {
  const { data: keys, isLoading } = useApiKeys();
  const { data: stats } = useApiKeyStats();
  const { data: scopesData } = useApiKeyScopes();
  const createKey = useCreateApiKey();
  const deleteKey = useDeleteApiKey();

  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState<number | undefined>(undefined);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['*']);
  const [scopePreset, setScopePreset] = useState<'full' | 'readonly' | 'custom'>('full');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const readOnlyScopes = (scopesData?.all ?? []).filter((s) => s.endsWith(':read'));

  const applyPreset = (preset: 'full' | 'readonly' | 'custom') => {
    setScopePreset(preset);
    if (preset === 'full') setSelectedScopes(['*']);
    else if (preset === 'readonly') setSelectedScopes(readOnlyScopes);
    else setSelectedScopes([]);
  };

  const toggleScope = (scope: string) => {
    setScopePreset('custom');
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const toggleGroup = (group: ScopeGroup) => {
    setScopePreset('custom');
    const allSelected = group.scopes.every((s) => selectedScopes.includes(s));
    if (allSelected) {
      setSelectedScopes((prev) => prev.filter((s) => !group.scopes.includes(s)));
    } else {
      setSelectedScopes((prev) => [...new Set([...prev, ...group.scopes])]);
    }
  };

  const toggleGroupExpand = (groupName: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const resetForm = () => {
    setName('');
    setExpiresIn(undefined);
    setSelectedScopes(['*']);
    setScopePreset('full');
    setExpandedGroups({});
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const result = await createKey.mutateAsync({
        name,
        expiresIn,
        scopes: selectedScopes,
      });
      setCreatedKey(result.key); // Show the full key
      setIsCreating(false);
      resetForm();
    } catch (error) {
      // Handled by hook
    }
  };

  const [deletingKeyId, setDeletingKeyId] = useState<number | null>(null);

  // ... create logic ...

  const confirmDelete = async () => {
    if (deletingKeyId) {
      await deleteKey.mutateAsync(deletingKeyId);
      setDeletingKeyId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className='min-h-screen bg-background'>
      <PageHeader>
        <div className='flex items-center justify-between'>
          <div>
            <Link to='/' className='inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2'>
              <ArrowLeft className='w-4 h-4' />
              Back to Dashboard
            </Link>
            <h2 className='text-2xl font-bold text-foreground flex items-center gap-2'>
              <Key className='w-6 h-6' />
              API Keys
            </h2>
            <p className='text-muted-foreground mt-1'>Manage API keys for external access</p>
          </div>
          <div className='flex gap-3'>
            <Link
              to='/api-docs'
              className='flex items-center gap-2 px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted transition-colors'
            >
              <Book className='w-4 h-4' />
              Documentation
            </Link>
            <button
              onClick={() => setIsCreating(true)}
              className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors'
            >
              <Plus className='w-4 h-4' />
              Create New Key
            </button>
          </div>
        </div>
      </PageHeader>

      <main className='container mx-auto px-6 py-8'>
        {/* Statistics Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
          <div className='bg-card border border-border rounded-lg p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-primary/10 rounded-lg'>
                <Key className='w-5 h-5 text-primary' />
              </div>
              <div>
                <p className='text-2xl font-bold text-foreground'>{stats?.totalKeys ?? 0}</p>
                <p className='text-sm text-muted-foreground'>Total Keys</p>
              </div>
            </div>
          </div>
          <div className='bg-card border border-border rounded-lg p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-blue-500/10 rounded-lg'>
                <Activity className='w-5 h-5 text-blue-500' />
              </div>
              <div>
                <p className='text-2xl font-bold text-foreground'>{stats?.totalUsage?.toLocaleString() ?? 0}</p>
                <p className='text-sm text-muted-foreground'>Total Requests</p>
              </div>
            </div>
          </div>
          <div className='bg-card border border-border rounded-lg p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-green-500/10 rounded-lg'>
                <Clock className='w-5 h-5 text-green-500' />
              </div>
              <div>
                <p className='text-2xl font-bold text-foreground'>{stats?.activeKeys ?? 0}</p>
                <p className='text-sm text-muted-foreground'>Active (7 days)</p>
              </div>
            </div>
          </div>
          <div className='bg-card border border-border rounded-lg p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-red-500/10 rounded-lg'>
                <AlertCircle className='w-5 h-5 text-red-500' />
              </div>
              <div>
                <p className='text-2xl font-bold text-foreground'>{stats?.expiredKeys ?? 0}</p>
                <p className='text-sm text-muted-foreground'>Expired</p>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deletingKeyId && (
          <div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50'>
            <div className='bg-card border border-border rounded-lg p-6 max-w-sm w-full shadow-xl'>
              <div className='flex items-center gap-2 text-destructive mb-4'>
                <AlertTriangle className='w-6 h-6' />
                <h3 className='text-xl font-bold text-foreground'>Revoke API Key?</h3>
              </div>
              <p className='text-muted-foreground mb-6'>
                Are you sure you want to revoke this API key? Any applications using it will immediately lose access.
                This action cannot be undone.
              </p>
              <div className='flex justify-end gap-3'>
                <button
                  onClick={() => setDeletingKeyId(null)}
                  className='px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className='px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors'
                >
                  Revoke Key
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal (Key Display) */}
        {createdKey && (
          <div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50'>
            <div className='bg-card border border-border rounded-lg p-6 max-w-md w-full shadow-xl'>
              <div className='flex items-center gap-2 text-green-500 mb-4'>
                <CheckCircle className='w-6 h-6' />
                <h3 className='text-xl font-bold'>API Key Created</h3>
              </div>
              <p className='text-muted-foreground mb-4'>
                Please copy your API key now.{' '}
                <strong className='text-destructive'>You will not be able to see it again!</strong>
              </p>

              <div className='bg-secondary p-4 rounded-md border border-border flex items-center justify-between gap-2 break-all mb-6'>
                <code className='font-mono text-sm text-foreground'>{createdKey}</code>
                <button
                  onClick={() => copyToClipboard(createdKey)}
                  className='p-2 hover:bg-muted rounded-md transition-colors'
                  title='Copy to clipboard'
                >
                  <Copy className='w-4 h-4' />
                </button>
              </div>

              <div className='flex justify-end'>
                <button
                  onClick={() => setCreatedKey(null)}
                  className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors'
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Key Modal */}
        {isCreating && (
          <div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50'>
            <div className='bg-card border border-border rounded-lg p-6 max-w-2xl w-full shadow-xl'>
              <h3 className='text-xl font-bold text-foreground mb-4'>Create New API Key</h3>
              <form onSubmit={handleCreate} className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium mb-1 text-foreground'>Name</label>
                  <input
                    type='text'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder='e.g. CI/CD Runner'
                    className='w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary'
                    required
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium mb-1 text-foreground'>Expiration</label>
                  <select
                    value={expiresIn || ''}
                    onChange={(e) => setExpiresIn(e.target.value ? parseInt(e.target.value) : undefined)}
                    className='w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary'
                  >
                    <option value=''>Never</option>
                    <option value='30'>30 Days</option>
                    <option value='90'>90 Days</option>
                    <option value='365'>1 Year</option>
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-medium mb-2 text-foreground'>Permissions</label>
                  {/* Preset buttons */}
                  <div className='flex gap-2 mb-3'>
                    <button
                      type='button'
                      onClick={() => applyPreset('full')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        scopePreset === 'full'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      Full Access (*)
                    </button>
                    <button
                      type='button'
                      onClick={() => applyPreset('readonly')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        scopePreset === 'readonly'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      Read Only
                    </button>
                    <button
                      type='button'
                      onClick={() => applyPreset('custom')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        scopePreset === 'custom'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  {/* Custom scope picker */}
                  {scopePreset !== 'full' && scopesData && (
                    <div className='border border-border rounded-md overflow-y-auto max-h-64'>
                      {scopesData.groups.map((group) => {
                        const allChecked = group.scopes.every((s) => selectedScopes.includes(s));
                        const someChecked = group.scopes.some((s) => selectedScopes.includes(s));
                        const isExpanded = expandedGroups[group.group] ?? false;
                        return (
                          <div key={group.group} className='border-b border-border last:border-b-0'>
                            <div className='flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50'>
                              <input
                                type='checkbox'
                                checked={allChecked}
                                ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked; }}
                                onChange={() => toggleGroup(group)}
                                className='h-4 w-4 rounded border-border text-primary'
                              />
                              <button
                                type='button'
                                className='flex items-center gap-1 flex-1 text-sm font-medium text-foreground text-left'
                                onClick={() => toggleGroupExpand(group.group)}
                              >
                                {isExpanded ? <ChevronDown className='w-3 h-3' /> : <ChevronRight className='w-3 h-3' />}
                                {group.label}
                              </button>
                            </div>
                            {isExpanded && (
                              <div className='px-6 py-1 space-y-1'>
                                {group.scopes.map((scope) => (
                                  <label key={scope} className='flex items-center gap-2 py-0.5 cursor-pointer'>
                                    <input
                                      type='checkbox'
                                      checked={selectedScopes.includes(scope)}
                                      onChange={() => toggleScope(scope)}
                                      className='h-4 w-4 rounded border-border text-primary'
                                    />
                                    <span className='text-sm font-mono text-muted-foreground'>{scope}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {scopePreset === 'full' && (
                    <p className='text-xs text-muted-foreground mt-1'>This key will have unrestricted access to all endpoints.</p>
                  )}
                  {scopePreset === 'custom' && (
                    <p className='text-xs text-muted-foreground mt-1'>{selectedScopes.length} scope{selectedScopes.length !== 1 ? 's' : ''} selected.</p>
                  )}
                </div>

                <div className='flex justify-end gap-3 mt-6'>
                  <button
                    type='button'
                    onClick={() => { setIsCreating(false); resetForm(); }}
                    className='px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted transition-colors'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    disabled={createKey.isPending || (scopePreset === 'custom' && selectedScopes.length === 0)}
                    className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50'
                  >
                    {createKey.isPending ? 'Creating...' : 'Create Key'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Keys List */}
        <div className='bg-card border rounded-lg overflow-hidden'>
          {isLoading ? (
            <div className='flex justify-center p-8'>Loading...</div>
          ) : keys?.length === 0 ? (
            <div className='text-center py-12'>
              <Key className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
              <h3 className='text-lg font-medium text-foreground'>No API Keys found</h3>
              <p className='text-muted-foreground mt-1'>Create a key to access the API externally.</p>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead className='bg-muted/50'>
                  <tr>
                    <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                      Name
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                      Prefix
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                      Scopes
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                      Created
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                      Usage
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                      Last Used
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                      Status
                    </th>
                    <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-border'>
                  {keys?.map((key: ApiKey) => (
                    <tr key={key.id} className='hover:bg-muted/30'>
                      <td className='px-6 py-4 text-sm font-medium text-foreground'>{key.name}</td>
                      <td className='px-6 py-4 text-sm font-mono text-muted-foreground'>{key.keyPrefix}...</td>
                      <td className='px-6 py-4 text-sm text-foreground'>
                        {key.scopes.map((scope) => (
                          <span
                            key={scope}
                            className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground mr-1'
                          >
                            {scope}
                          </span>
                        ))}
                      </td>
                      <td className='px-6 py-4 text-sm text-muted-foreground'>
                        {format(new Date(key.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className='px-6 py-4 text-sm font-medium text-foreground'>
                        {key.usageCount?.toLocaleString() ?? 0}
                      </td>
                      <td className='px-6 py-4 text-sm text-muted-foreground'>
                        {key.lastUsedAt ? format(new Date(key.lastUsedAt), 'MMM d, HH:mm') : 'Never'}
                      </td>
                      <td className='px-6 py-4 text-sm'>
                        {key.expiresAt ? (
                          new Date(key.expiresAt) < new Date() ? (
                            <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700'>
                              Expired
                            </span>
                          ) : (
                            <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700'>
                              Active
                            </span>
                          )
                        ) : (
                          <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700'>
                            Never Expires
                          </span>
                        )}
                      </td>
                      <td className='px-6 py-4 text-right'>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingKeyId(key.id);
                          }}
                          disabled={deleteKey.isPending}
                          className='relative z-10 text-destructive hover:text-destructive/80 p-2 rounded-md hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                          title='Revoke Key'
                        >
                          <Trash2 className='w-4 h-4 pointer-events-none' />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
