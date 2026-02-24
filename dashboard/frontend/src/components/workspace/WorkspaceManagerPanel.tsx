import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { instancesApi } from '../../lib/api';
import {
  Loader2,
  Database,
  Cloud,
  Server,
  Code,
  Table,
  Plus,
  Play,
  ChevronRight,
  RefreshCw,
  Trash2,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import CreateTableModal from '../CreateTableModal';
import TableDataBrowser from '../TableDataBrowser';
import ConfirmationModal from '../ConfirmationModal';
import PoliciesTab from '../PoliciesTab';
import FunctionsTab from '../FunctionsTab';
import StorageTab from '../StorageTab';

type ManagerTab = 'database' | 'storage' | 'policies' | 'functions';

interface WorkspaceManagerPanelProps {
  instanceName: string;
}

export default function WorkspaceManagerPanel({ instanceName }: WorkspaceManagerPanelProps) {
  const [activeTab, setActiveTab] = useState<ManagerTab>('database');

  const tabs = [
    { id: 'database' as ManagerTab, label: 'Database', icon: Database },
    { id: 'storage' as ManagerTab, label: 'Storage', icon: Server },
    { id: 'policies' as ManagerTab, label: 'RLS Policies', icon: Shield },
    { id: 'functions' as ManagerTab, label: 'Edge Functions', icon: Cloud },
  ];

  return (
    <div className='space-y-4'>
      {/* Sub-tabs */}
      <div className='flex gap-1 overflow-x-auto scrollbar-hide'>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-brand-500/15 text-brand-400'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              <Icon className='w-4 h-4' />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'functions' && <FunctionsTab instanceName={instanceName} />}
      {activeTab === 'database' && <DatabasePanel instanceName={instanceName} />}
      {activeTab === 'policies' && <PoliciesTab instanceName={instanceName} />}
      {activeTab === 'storage' && <StorageTab instanceName={instanceName} />}
    </div>
  );
}

// Embedded Database Panel (same logic as SupabaseManager's DatabaseTab)
function DatabasePanel({ instanceName }: { instanceName: string }) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; tableName: string | null }>({
    isOpen: false,
    tableName: null,
  });
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM auth.users LIMIT 10;');
  const [sqlResult, setSqlResult] = useState<any[] | null>(null);

  const {
    data: schemaData,
    isLoading: isLoadingSchema,
    refetch: refetchSchema,
  } = useQuery({
    queryKey: ['instance-schema', instanceName],
    queryFn: () => instancesApi.getSchema(instanceName),
  });

  const sqlMutation = useMutation({
    mutationFn: (query: string) => instancesApi.executeSQL(instanceName, query),
    onSuccess: (data) => {
      if (data.error) {
        toast.error('SQL Error', { description: data.error });
        setSqlResult([]);
      } else {
        setSqlResult(data.rows);
        toast.success(`Query returned ${data.rows.length} rows`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to execute SQL');
    },
  });

  const confirmDeleteTable = () => {
    if (!deleteConfirmation.tableName) return;
    sqlMutation.mutate(`DROP TABLE public."${deleteConfirmation.tableName}" CASCADE;`);
    setDeleteConfirmation({ isOpen: false, tableName: null });
    setTimeout(() => refetchSchema(), 500);
  };

  const handleDeleteTable = (tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmation({ isOpen: true, tableName });
  };

  const handleRunQuery = () => {
    if (!sqlQuery.trim()) return;
    sqlMutation.mutate(sqlQuery);
  };

  const tableList = schemaData?.tables || [];

  return (
    <div className='space-y-4'>
      <div className='flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-[700px]'>
        {/* Sidebar: Table List */}
        <div className='w-full lg:w-1/4 glass-card flex flex-col max-h-60 lg:max-h-none'>
          <div className='p-4 border-b border-white/10 flex items-center justify-between'>
            <h3 className='font-semibold flex items-center gap-2 text-sm'>
              <Table className='w-4 h-4 text-brand-400' />
              Tables
            </h3>
            <div className='flex gap-1'>
              <button
                onClick={() => setShowCreateModal(true)}
                className='p-1.5 hover:bg-white/10 rounded-md text-brand-400 transition-colors'
                title='New Table'
              >
                <Plus className='w-4 h-4' />
              </button>
              <button
                onClick={() => refetchSchema()}
                className='p-1.5 hover:bg-white/10 rounded-md text-muted-foreground transition-colors'
                title='Refresh'
              >
                <RefreshCw className='w-4 h-4' />
              </button>
            </div>
          </div>

          <div className='flex-1 overflow-y-auto p-2'>
            {isLoadingSchema ? (
              <div className='flex justify-center py-4'>
                <Loader2 className='w-5 h-5 animate-spin text-muted-foreground' />
              </div>
            ) : tableList.length > 0 ? (
              <div className='space-y-1'>
                {tableList.map((table: any) => (
                  <div
                    key={table.name}
                    onClick={() => setSelectedTable(table.name)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                      selectedTable === table.name
                        ? 'bg-brand-500/10 text-brand-400 font-medium'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                    }`}
                  >
                    <div className='flex items-center gap-2 truncate'>
                      <Database className='w-3 h-3' />
                      <span className='truncate'>{table.name}</span>
                    </div>
                    <div className='flex items-center gap-1'>
                      {selectedTable === table.name && <ChevronRight className='w-3 h-3' />}
                      <button
                        onClick={(e) => handleDeleteTable(table.name, e)}
                        className='p-1 rounded-md opacity-50 hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all'
                        title='Delete Table'
                      >
                        <Trash2 className='w-3 h-3' />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-8 text-xs text-muted-foreground'>
                No tables found.
                <br />
                Create one to get started.
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
          {/* Table View */}
          {selectedTable ? (
            <div className='glass-card flex-1 flex flex-col p-4 overflow-hidden'>
              <TableDataBrowser instanceName={instanceName} tableName={selectedTable} />
            </div>
          ) : (
            <div className='glass-card flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground'>
              <Database className='w-16 h-16 opacity-20 mb-4' />
              <h3 className='text-lg font-semibold mb-2 text-foreground'>Select a Table</h3>
              <p className='text-sm'>Select a table from the sidebar to view its data and schema</p>
            </div>
          )}

          {/* SQL Editor */}
          <div className='glass-card p-4 min-h-[250px] flex flex-col'>
            <h3 className='text-sm font-semibold flex items-center gap-2 mb-3'>
              <Code className='w-4 h-4 text-brand-400' />
              Quick SQL Editor
            </h3>
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder='SELECT * FROM ...'
              className='flex-1 w-full p-3 bg-white/5 border border-white/10 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-foreground placeholder:text-muted-foreground/40'
            />
            <div className='flex justify-between items-center mt-3'>
              <span className='text-xs text-muted-foreground'>
                {sqlResult ? `${sqlResult.length} rows returned` : 'Ready to execute'}
              </span>
              <button
                onClick={handleRunQuery}
                disabled={sqlMutation.isPending}
                className='flex items-center gap-2 px-4 py-1.5 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 shadow-[0_0_10px_rgba(62,207,142,0.2)]'
              >
                {sqlMutation.isPending ? <Loader2 className='w-3 h-3 animate-spin' /> : <Play className='w-3 h-3' />}
                Run
              </button>
            </div>
            {sqlResult && sqlResult.length > 0 && (
              <div className='mt-3 bg-white/5 border border-white/10 rounded-lg p-2 overflow-x-auto h-32 text-xs font-mono text-muted-foreground'>
                {JSON.stringify(sqlResult, null, 2)}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateTableModal
          instanceName={instanceName}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => refetchSchema()}
        />
      )}

      {deleteConfirmation.isOpen && (
        <ConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          title='Delete Table'
          message={`Are you sure you want to delete table "${deleteConfirmation.tableName}"? This action cannot be undone and will delete all data within the table.`}
          confirmText='Delete Table'
          onClose={() => setDeleteConfirmation({ isOpen: false, tableName: null })}
          onConfirm={confirmDeleteTable}
          isLoading={sqlMutation.isPending}
        />
      )}
    </div>
  );
}
