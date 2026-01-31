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
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { toast } from 'sonner';

type TabType = 'functions' | 'database';

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
    { id: 'functions' as TabType, label: 'Edge Functions', icon: Cloud },
  ];

  return (
    <div className='min-h-screen bg-background'>
      <PageHeader>
        <div className='flex items-center gap-4 mb-4'>
          <Link to={`/instances/${name}`} className='p-2 hover:bg-secondary rounded-lg transition-colors'>
            <ChevronLeft className='w-5 h-5' />
          </Link>
          <div>
            <h1 className='text-2xl font-bold flex items-center gap-2'>
              <Code className='w-6 h-6 text-primary' />
              Supabase Manager
            </h1>
            <p className='text-muted-foreground'>{instance.name}</p>
          </div>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className='border-b bg-card'>
        <div className='container mx-auto px-6'>
          <div className='flex gap-1'>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                  }`}
                >
                  <Icon className='w-4 h-4' />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <main className='container mx-auto px-6 py-6'>
        {activeTab === 'functions' && <FunctionsTab instanceName={name!} />}
        {activeTab === 'database' && <DatabaseTab instanceName={name!} />}
      </main>
    </div>
  );
}

// Edge Functions Tab (Placeholder)
function FunctionsTab({ instanceName: _instanceName }: { instanceName: string }) {
  return (
    <div className='space-y-6'>
      <div className='bg-card p-6 rounded-lg border border-border'>
        <div className='flex items-center justify-between mb-6'>
          <h3 className='text-lg font-semibold flex items-center gap-2'>
            <Cloud className='w-5 h-5 text-primary' />
            Edge Functions
          </h3>
          <button className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors'>
            <Plus className='w-4 h-4' />
            New Function
          </button>
        </div>

        <div className='text-center py-12 text-muted-foreground'>
          <Cloud className='w-12 h-12 mx-auto mb-4 opacity-50' />
          <p className='text-lg font-medium'>Edge Functions Coming Soon</p>
          <p className='text-sm mt-1'>Deploy serverless TypeScript functions</p>
        </div>
      </div>

      <div className='bg-secondary/30 border border-border rounded-lg p-4'>
        <h4 className='font-medium mb-2'>What are Edge Functions?</h4>
        <p className='text-sm text-muted-foreground'>
          Edge Functions are server-side TypeScript functions that run on Deno. They can handle webhooks, scheduled
          tasks, or custom API endpoints.
        </p>
      </div>
    </div>
  );
}

// Database Tab
function DatabaseTab({ instanceName }: { instanceName: string }) {
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM auth.users LIMIT 10;');
  const [sqlResult, setSqlResult] = useState<any[] | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

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

  const handleRunQuery = () => {
    if (!sqlQuery.trim()) return;
    sqlMutation.mutate(sqlQuery);
  };

  return (
    <div className='space-y-6'>
      {/* Tables List */}
      <div className='bg-card p-6 rounded-lg border border-border'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold flex items-center gap-2'>
            <Table className='w-5 h-5 text-primary' />
            Database Tables
          </h3>
          <button
            onClick={() => refetchSchema()}
            className='p-2 hover:bg-secondary rounded-lg transition-colors'
            title='Refresh schema'
          >
            <RefreshCw className='w-4 h-4' />
          </button>
        </div>

        {isLoadingSchema ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='w-6 h-6 animate-spin text-primary' />
          </div>
        ) : schemaData?.tables && schemaData.tables.length > 0 ? (
          <div className='space-y-2'>
            {schemaData.tables.map((table: any) => (
              <div
                key={table.name}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedTable === table.name
                    ? 'bg-primary/10 border-primary'
                    : 'bg-secondary/30 border-transparent hover:border-border'
                }`}
                onClick={() => setSelectedTable(selectedTable === table.name ? null : table.name)}
              >
                <div className='flex items-center gap-3'>
                  <Database className='w-4 h-4 text-muted-foreground' />
                  <span className='font-mono text-sm'>{table.name}</span>
                  <span className='text-xs text-muted-foreground'>({table.columns?.length || 0} columns)</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    selectedTable === table.name ? 'rotate-90' : ''
                  }`}
                />
              </div>
            ))}

            {/* Selected table columns */}
            {selectedTable && (
              <div className='mt-4 p-4 bg-secondary/20 rounded-lg border border-border'>
                <h4 className='font-medium mb-3'>
                  Columns in <span className='font-mono text-primary'>{selectedTable}</span>
                </h4>
                <div className='grid gap-2'>
                  {schemaData.tables
                    .find((t: any) => t.name === selectedTable)
                    ?.columns?.map((col: any) => (
                      <div key={col.column_name} className='flex items-center gap-4 text-sm'>
                        <span className='font-mono w-40'>{col.column_name}</span>
                        <span className='text-muted-foreground'>{col.data_type}</span>
                        {col.is_nullable === 'NO' && (
                          <span className='text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded'>NOT NULL</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className='text-center py-8 text-muted-foreground'>
            <Database className='w-12 h-12 mx-auto mb-4 opacity-50' />
            <p className='text-lg font-medium'>No tables found</p>
            <p className='text-sm mt-1'>Create tables using the SQL editor below</p>
          </div>
        )}
      </div>

      {/* SQL Editor */}
      <div className='bg-card p-6 rounded-lg border border-border'>
        <h3 className='text-lg font-semibold flex items-center gap-2 mb-4'>
          <Code className='w-5 h-5 text-primary' />
          SQL Editor
        </h3>
        <div className='space-y-4'>
          <textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            placeholder='SELECT * FROM your_table LIMIT 10;'
            className='w-full h-32 px-4 py-3 bg-background border border-border rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50'
          />
          <div className='flex justify-end'>
            <button
              onClick={handleRunQuery}
              disabled={sqlMutation.isPending}
              className='flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50'
            >
              {sqlMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Play className='w-4 h-4' />}
              Run Query
            </button>
          </div>

          {/* Results */}
          {sqlResult !== null && (
            <div className='mt-4'>
              <h4 className='text-sm font-medium mb-2'>Results ({sqlResult.length} rows)</h4>
              <div className='bg-secondary/30 rounded-lg p-4 overflow-x-auto max-h-64 overflow-y-auto'>
                {sqlResult.length > 0 ? (
                  <pre className='font-mono text-xs'>
                    {sqlResult.map((row, i) => (
                      <div key={i} className='py-1 border-b border-border/50 last:border-0'>
                        {Array.isArray(row) ? row.join(' | ') : JSON.stringify(row)}
                      </div>
                    ))}
                  </pre>
                ) : (
                  <p className='text-muted-foreground text-sm'>No results</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
