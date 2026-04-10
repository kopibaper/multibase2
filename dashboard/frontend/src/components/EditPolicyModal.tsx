import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { X, Loader2, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface Policy {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string[];
  cmd: string;
  qual: string;
  with_check: string;
}

interface EditPolicyModalProps {
  instanceName: string;
  tableName: string;
  policy: Policy;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES = ['anon', 'authenticated', 'service_role'];

export default function EditPolicyModal({
  instanceName,
  tableName,
  policy,
  onClose,
  onSuccess,
}: EditPolicyModalProps) {
  const [policyName, setPolicyName] = useState(policy.policyname);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    Array.isArray(policy.roles) ? policy.roles.filter((r) => ROLES.includes(r)) : []
  );
  const [usingExpression, setUsingExpression] = useState(policy.qual || '');
  const [withCheckExpression, setWithCheckExpression] = useState(policy.with_check || '');

  const editPolicyMutation = useMutation({
    mutationFn: async () => {
      // Build ALTER POLICY to update roles and expressions (using original name first)
      let alterSql = `ALTER POLICY "${policy.policyname}" ON public."${tableName}"`;

      if (selectedRoles.length > 0) {
        alterSql += ` TO ${selectedRoles.join(', ')}`;
      } else {
        alterSql += ` TO PUBLIC`;
      }

      if (usingExpression.trim()) {
        alterSql += ` USING (${usingExpression})`;
      }

      if (withCheckExpression.trim()) {
        alterSql += ` WITH CHECK (${withCheckExpression})`;
      }

      alterSql += ';';

      const res1 = await instancesApi.executeSQL(instanceName, alterSql);
      if (res1.error) throw new Error(res1.error);

      // Rename if the name was changed (must be separate statement)
      if (policyName.trim() !== policy.policyname) {
        const renameSql = `ALTER POLICY "${policy.policyname}" ON public."${tableName}" RENAME TO "${policyName.trim()}";`;
        const res2 = await instancesApi.executeSQL(instanceName, renameSql);
        if (res2.error) throw new Error(res2.error);
      }

      return { success: true };
    },
    onSuccess: () => {
      toast.success(`Policy "${policyName}" updated`);
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Failed to update policy', { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyName.trim()) {
      toast.error('Policy name is required');
      return;
    }
    editPolicyMutation.mutate();
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm'>
      <div className='glass-modal w-full max-w-xl max-h-[75vh] flex flex-col'>
        <div className='flex items-center justify-between px-5 py-3 border-b border-border'>
          <div>
            <h2 className='text-xl font-semibold flex items-center gap-2'>
              <Shield className='w-5 h-5 text-primary' />
              Edit RLS Policy
            </h2>
            <p className='text-sm text-muted-foreground'>
              Table: <span className='font-mono text-foreground'>{tableName}</span>
              <span className='mx-2'>·</span>
              Command: <span className='font-mono text-foreground'>{policy.cmd}</span>
              <span className='text-xs text-muted-foreground ml-2'>(Command type cannot be changed)</span>
            </p>
          </div>
          <button onClick={onClose} className='text-muted-foreground hover:text-foreground'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='flex-1 overflow-y-auto px-5 py-3 space-y-4'>
          {/* Name */}
          <div>
            <label className='block text-sm font-medium mb-2'>Policy Name</label>
            <input
              type='text'
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              className='w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
              autoFocus
            />
          </div>

          {/* Roles */}
          <div>
            <label className='block text-sm font-medium mb-2'>Allowed Roles (Empty = PUBLIC)</label>
            <div className='flex gap-4 flex-wrap'>
              {ROLES.map((role) => (
                <label
                  key={role}
                  className='flex items-center gap-2 cursor-pointer bg-secondary/30 px-3 py-2 rounded-md hover:bg-secondary/50 transition-colors'
                >
                  <input
                    type='checkbox'
                    checked={selectedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className='rounded border-muted'
                  />
                  <span className='text-sm font-mono'>{role}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Expressions */}
          <div className='space-y-4'>
            <div>
              <div className='flex justify-between items-center mb-2'>
                <label className='block text-sm font-medium'>USING Expression</label>
                <span className='text-xs text-muted-foreground'>Determines which rows are visible/modifiable</span>
              </div>
              <textarea
                value={usingExpression}
                onChange={(e) => setUsingExpression(e.target.value)}
                className='w-full px-4 py-3 bg-secondary/20 border border-border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[80px]'
                placeholder='e.g. true OR auth.uid() = user_id'
              />
            </div>
            <div>
              <div className='flex justify-between items-center mb-2'>
                <label className='block text-sm font-medium'>WITH CHECK Expression (Optional)</label>
                <span className='text-xs text-muted-foreground'>For INSERT/UPDATE checks</span>
              </div>
              <textarea
                value={withCheckExpression}
                onChange={(e) => setWithCheckExpression(e.target.value)}
                className='w-full px-4 py-3 bg-secondary/20 border border-border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[80px]'
                placeholder='e.g. auth.uid() = user_id'
              />
            </div>
          </div>

          <div className='bg-blue-500/10 border border-blue-500/20 rounded-md p-4 text-sm text-blue-400'>
            <p>
              Note: The command type (<strong>{policy.cmd}</strong>) and permissiveness (<strong>{policy.permissive}</strong>)
              cannot be changed via ALTER POLICY. Drop and recreate the policy to change these.
            </p>
          </div>
        </form>

        <div className='px-5 py-3 border-t border-border flex justify-end gap-2'>
          <button
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={(e) => handleSubmit(e)}
            disabled={editPolicyMutation.isPending || !policyName.trim()}
            className='flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50'
          >
            {editPolicyMutation.isPending ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <Save className='w-4 h-4' />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
