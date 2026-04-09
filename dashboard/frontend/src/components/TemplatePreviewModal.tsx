import { useState } from 'react';
import { X, Check, Server, Shield, Cpu, Puzzle, Database, ChevronDown, ChevronUp } from 'lucide-react';
import { InstanceTemplate } from '../types';
import { useNavigate } from 'react-router-dom';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  template: InstanceTemplate | null;
  onClose: () => void;
}

export default function TemplatePreviewModal({ isOpen, template, onClose }: TemplatePreviewModalProps) {
  const navigate = useNavigate();
  const [showInitSql, setShowInitSql] = useState(false);

  if (!isOpen || !template) return null;

  const config = template.config || {};
  const envVars = config.env || {};
  const extensions = config.extensions || [];
  const resourceLimits = config.resourceLimits;

  const handleUseTemplate = () => {
    navigate('/dashboard', { state: { openCreateModal: true, template } });
    onClose();
  };

  return (
    <div className='fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50'>
      <div className='glass-modal w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-xl'>
        <div className='flex items-start justify-between p-4 sm:p-6 border-b border-border flex-shrink-0'>
          <div className='min-w-0 pr-3'>
            <div className='flex items-center gap-2'>
              <h2 className='text-xl sm:text-2xl font-bold text-foreground truncate'>{template.name}</h2>
              {config.environment && (
                <span className='text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize'>
                  {config.environment}
                </span>
              )}
            </div>
            <p className='text-muted-foreground mt-1 text-sm'>{template.description || 'No description provided'}</p>
          </div>
          <button onClick={onClose} className='p-2 hover:bg-muted rounded-full transition-colors'>
            <X className='w-5 h-5 text-muted-foreground' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto p-4 sm:p-6 space-y-6'>
          {/* Main Info */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='bg-secondary/30 p-4 rounded-lg border border-border'>
              <div className='flex items-center gap-2 mb-2 text-primary'>
                <Server className='w-4 h-4' />
                <span className='font-medium'>Deployment</span>
              </div>
              <p className='text-foreground capitalize'>{config.deploymentType || 'Cloud'}</p>
            </div>

            {resourceLimits && (
              <div className='bg-secondary/30 p-4 rounded-lg border border-border'>
                <div className='flex items-center gap-2 mb-2 text-primary'>
                  <Cpu className='w-4 h-4' />
                  <span className='font-medium'>Resources</span>
                </div>
                <p className='text-foreground'>
                  {resourceLimits.preset ? (
                    <span className='capitalize'>{resourceLimits.preset}</span>
                  ) : (
                    <>
                      {resourceLimits.cpus && `${resourceLimits.cpus} CPU`}
                      {resourceLimits.cpus && resourceLimits.memory && ' / '}
                      {resourceLimits.memory && `${resourceLimits.memory} MB`}
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Extensions */}
          {extensions.length > 0 && (
            <div>
              <h3 className='text-lg font-semibold mb-3 flex items-center gap-2'>
                <Puzzle className='w-5 h-5' />
                Extensions
              </h3>
              <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
                {extensions.map((ext: string) => (
                  <div
                    key={ext}
                    className='flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-md border border-border'
                  >
                    <div className='w-2 h-2 rounded-full bg-blue-500' />
                    <span className='text-sm font-medium'>{ext}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Init SQL */}
          {config.initSql && (
            <div>
              <button
                onClick={() => setShowInitSql(!showInitSql)}
                className='flex items-center gap-2 text-lg font-semibold mb-3 hover:text-primary transition-colors'
              >
                <Database className='w-5 h-5' />
                Initial SQL
                {showInitSql ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
              </button>
              {showInitSql && (
                <pre className='bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto max-h-48 overflow-y-auto border border-border'>
                  {config.initSql}
                </pre>
              )}
            </div>
          )}

          {/* Env Vars */}
          {Object.keys(envVars).length > 0 && (
            <div>
              <h3 className='text-lg font-semibold mb-3 flex items-center gap-2'>
                <Shield className='w-5 h-5' />
                Environment Variables
              </h3>
              <div className='bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto'>
                {Object.entries(envVars).map(([key, value]) => (
                  <div key={key} className='flex gap-2 border-b border-border/50 last:border-0 py-1'>
                    <span className='text-blue-400'>{key}</span>
                    <span className='text-muted-foreground'>=</span>
                    <span className='text-green-400'>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta Info */}
          <div className='text-sm text-muted-foreground pt-4 border-t border-border'>
            Created by <span className='font-medium text-foreground'>{template.creator?.username || 'Unknown'}</span> on{' '}
            {new Date(template.createdAt).toLocaleDateString()}
          </div>
        </div>

        <div className='p-4 sm:p-6 border-t border-border flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-secondary/10 flex-shrink-0'>
          <button
            onClick={onClose}
            className='w-full sm:w-auto px-4 py-2.5 border border-border rounded-md text-foreground hover:bg-muted transition-colors text-sm'
          >
            Cancel
          </button>
          <button
            onClick={handleUseTemplate}
            className='w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium shadow-sm text-sm'
          >
            <Check className='w-4 h-4' />
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}
