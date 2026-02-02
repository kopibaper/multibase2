import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useInstance } from '../hooks/useInstances';
import { instancesApi } from '../lib/api';
import {
  ChevronLeft,
  Loader2,
  Server,
  Cloud,
  Database,
  Code,
  Table,
  Plus,
  Play,
  ChevronRight,
  RefreshCw,
  Trash2,
  Shield,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { toast } from 'sonner';
import CreateTableModal from '../components/CreateTableModal';
import TableDataBrowser from '../components/TableDataBrowser';
import ConfirmationModal from '../components/ConfirmationModal';
import PoliciesTab from '../components/PoliciesTab';
import FunctionsTab from '../components/FunctionsTab';
import StorageTab from '../components/StorageTab';

type TabType = 'functions' | 'database' | 'policies' | 'storage';

export default function SupabaseManager() {
  const { name } = useParams<{ name: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('database');

  const { data: instance, isLoading, error } = useInstance(name!);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <Loader2 className='w-8 h-8 animate-spin text-primary' />
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <Server className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
          <h2 className='text-xl font-semibold mb-2'>Instance not found</h2>
          <p className='text-muted-foreground mb-4'>The instance "{name}" could not be found</p>
          <Link to='/dashboard' className='text-primary hover:underline'>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'database' as TabType, label: 'Database', icon: Database },
    { id: 'storage' as TabType, label: 'Storage', icon: Server },
    { id: 'policies' as TabType, label: 'RLS Policies', icon: Shield },
    { id: 'functions' as TabType, label: 'Edge Functions', icon: Cloud },
  ];

  return (
    <div className='min-h-screen bg-background'>
      <PageHeader>
        <div className='flex items-center gap-3 sm:gap-4 mb-4'>
          <Link to={`/instances/${name}`} className='p-2 hover:bg-secondary rounded-lg transition-colors'>
            <ChevronLeft className='w-5 h-5' />
          </Link>
          <div className='min-w-0'>
            <h1 className='text-xl sm:text-2xl font-bold flex items-center gap-2'>
              <Code className='w-5 sm:w-6 h-5 sm:h-6 text-primary flex-shrink-0' />
              <span className='hidden sm:inline'>Supabase Manager</span>
              <span className='sm:hidden'>Manager</span>
            </h1>
            <p className='text-muted-foreground truncate'>{instance.name}</p>
          </div>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className='border-b bg-card'>
        <div className='container mx-auto px-4 sm:px-6'>
          <div className='flex gap-1 overflow-x-auto scrollbar-hide -mx-4 sm:-mx-0 px-4 sm:px-0'>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                  }`}
                >
                  <Icon className='w-4 h-4' />
                  <span className='hidden sm:inline'>{tab.label}</span>
                  <span className='sm:hidden'>{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <main className='container mx-auto px-4 sm:px-6 py-4 sm:py-6'>
        {activeTab === 'functions' && <FunctionsTab instanceName={name!} />}
        {activeTab === 'database' && <DatabaseTab instanceName={name!} />}
        {activeTab === 'policies' && <PoliciesTab instanceName={name!} />}
        {activeTab === 'storage' && <StorageTab instanceName={name!} />}
      </main>
    </div>
  );
}

// Database Tab
function DatabaseTab({ instanceName }: { instanceName: string }) {
  const [activeView, setActiveView] = useState<'schema' | 'data'>('schema');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; tableName: string | null }>({
    isOpen: false,
    tableName: null,
  });
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM auth.users LIMIT 10;');
  const [sqlResult, setSqlResult] = useState<any[] | null>(null);

  // Fetch schema
  const {
    data: schemaData,
    isLoading: isLoadingSchema,
    refetch: refetchSchema,
  } = useQuery({
    queryKey: ['instance-schema', instanceName],
    queryFn: () => instancesApi.getSchema(instanceName),
  });

  // SQL mutation
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
    <div className='space-y-4 sm:space-y-6'>
      <div className='flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-[800px]'>
        {/* Sidebar: Table List */}
        <div className='w-full lg:w-1/4 bg-card rounded-lg border border-border flex flex-col max-h-60 lg:max-h-none'>
          <div className='p-4 border-b border-border flex items-center justify-between'>
            <h3 className='font-semibold flex items-center gap-2'>
              <Table className='w-4 h-4 text-primary' />
              Tables
            </h3>
            <div className='flex gap-1'>
              <button
                onClick={() => setShowCreateModal(true)}
                className='p-1.5 hover:bg-secondary rounded-md text-primary transition-colors'
                title='New Table'
              >
                <Plus className='w-4 h-4' />
              </button>
              <button
                onClick={() => refetchSchema()}
                className='p-1.5 hover:bg-secondary rounded-md text-muted-foreground transition-colors'
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
                    onClick={() => {
                      setSelectedTable(table.name);
                      setActiveView('data');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                      selectedTable === table.name
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
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
                        className='p-1 rounded-md opacity-50 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all'
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
        <div className='flex-1 flex flex-col gap-6 overflow-hidden'>
          {/* Table View */}
          {selectedTable && activeView === 'data' ? (
            <div className='bg-card rounded-lg border border-border flex-1 flex flex-col p-4 overflow-hidden'>
              <TableDataBrowser instanceName={instanceName} tableName={selectedTable} />
            </div>
          ) : (
            /* Empty / Intro State */
            <div className='bg-card rounded-lg border border-border flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground'>
              <Database className='w-16 h-16 opacity-30 mb-4' />
              <h3 className='text-xl font-semibold mb-2'>Select a Table</h3>
              <p>Select a table from the sidebar to view its data and scheme</p>
            </div>
          )}

          {/* SQL Editor Toggle / Section */}
          <div className='bg-card p-4 rounded-lg border border-border min-h-[300px] flex flex-col'>
            <h3 className='text-sm font-semibold flex items-center gap-2 mb-3'>
              <Code className='w-4 h-4 text-primary' />
              Quick SQL Editor
            </h3>
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder='SELECT * FROM ...'
              className='flex-1 w-full p-3 bg-secondary/20 border border-border rounded-md font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50'
            />
            <div className='flex justify-between items-center mt-3'>
              <span className='text-xs text-muted-foreground'>
                {sqlResult ? `${sqlResult.length} rows returned` : 'Ready to execute'}
              </span>
              <button
                onClick={handleRunQuery}
                disabled={sqlMutation.isPending}
                className='flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50'
              >
                {sqlMutation.isPending ? <Loader2 className='w-3 h-3 animate-spin' /> : <Play className='w-3 h-3' />}
                Run
              </button>
            </div>
            {/* Mini Result Viewer */}
            {sqlResult && sqlResult.length > 0 && (
              <div className='mt-3 bg-secondary/30 rounded-md p-2 overflow-x-auto h-32 text-xs font-mono'>
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
