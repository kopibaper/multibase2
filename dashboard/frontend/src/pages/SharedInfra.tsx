import { useState } from 'react';
import {
  useSharedStatus,
  useSharedDatabases,
  useStartSharedInfra,
  useStopSharedInfra,
  useDeleteDatabase,
} from '../hooks/useShared';
import {
  Loader2,
  AlertCircle,
  Play,
  Square,
  Database,
  Server,
  Activity,
  HardDrive,
  Trash2,
  RefreshCw,
  Cloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export default function SharedInfra() {
  const { data: status, isLoading, error, refetch } = useSharedStatus();
  const { data: dbData } = useSharedDatabases();
  const startMutation = useStartSharedInfra();
  const stopMutation = useStopSharedInfra();
  const deleteMutation = useDeleteDatabase();
  const [confirmStop, setConfirmStop] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <Loader2 className='w-8 h-8 animate-spin text-primary' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <AlertCircle className='w-12 h-12 text-destructive mx-auto mb-4' />
          <h2 className='text-xl font-semibold mb-2'>Shared Infrastructure nicht erreichbar</h2>
          <p className='text-muted-foreground mb-4'>
            {error instanceof Error ? error.message : 'Verbindung fehlgeschlagen'}
          </p>
          <button onClick={() => refetch()} className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90'>
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  const statusColor =
    status?.status === 'running'
      ? 'text-brand-400'
      : status?.status === 'degraded'
        ? 'text-yellow-400'
        : 'text-red-400';

  const StatusIcon =
    status?.status === 'running'
      ? CheckCircle2
      : status?.status === 'degraded'
        ? AlertTriangle
        : XCircle;

  return (
    <div className='min-h-screen'>
      {/* Page Header */}
      <header className='border-b border-white/5 bg-card/30 backdrop-blur-sm sticky top-0 z-20'>
        <div className='px-8 py-6'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-4'>
              <div className='w-12 h-12 bg-brand-500/20 rounded-xl flex items-center justify-center'>
                <Cloud className='w-6 h-6 text-brand-400' />
              </div>
              <div>
                <h1 className='text-2xl font-bold text-foreground'>Shared Infrastructure</h1>
                <div className='flex items-center gap-2 mt-1'>
                  <StatusIcon className={`w-4 h-4 ${statusColor}`} />
                  <span className={`text-sm font-medium ${statusColor}`}>
                    {status?.status === 'running' ? 'Läuft' : status?.status === 'degraded' ? 'Beeinträchtigt' : 'Gestoppt'}
                  </span>
                  <span className='text-muted-foreground text-sm'>
                    — {status?.runningServices || 0}/{status?.totalServices || 0} Services
                  </span>
                </div>
              </div>
            </div>

            <div className='flex items-center gap-3'>
              <button onClick={() => refetch()} className='btn-secondary flex items-center gap-2 px-4 py-2'>
                <RefreshCw className='w-4 h-4' />
                Aktualisieren
              </button>

              {status?.status === 'running' || status?.status === 'degraded' ? (
                <button
                  onClick={() => (confirmStop ? stopMutation.mutate() : setConfirmStop(true))}
                  disabled={stopMutation.isPending}
                  className='flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors'
                >
                  {stopMutation.isPending ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <Square className='w-4 h-4' />
                  )}
                  {confirmStop ? 'Wirklich stoppen?' : 'Stoppen'}
                </button>
              ) : (
                <button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className='btn-primary flex items-center gap-2 px-4 py-2'
                >
                  {startMutation.isPending ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <Play className='w-4 h-4' />
                  )}
                  Starten
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='container mx-auto px-6 py-8'>
        {/* Stats Overview */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-6 mb-8'>
          <div className='glass-card p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>Services</p>
                <p className='text-3xl font-bold mt-1 text-foreground'>
                  {status?.runningServices || 0}
                  <span className='text-lg text-muted-foreground'>/{status?.totalServices || 0}</span>
                </p>
              </div>
              <div className='w-12 h-12 bg-brand-500/20 rounded-xl flex items-center justify-center'>
                <Server className='w-6 h-6 text-brand-400' />
              </div>
            </div>
          </div>

          <div className='glass-card p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>Datenbanken</p>
                <p className='text-3xl font-bold mt-1 text-brand-400'>{dbData?.count || 0}</p>
              </div>
              <div className='w-12 h-12 bg-brand-500/20 rounded-xl flex items-center justify-center'>
                <Database className='w-6 h-6 text-brand-400' />
              </div>
            </div>
          </div>

          <div className='glass-card p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>PostgreSQL</p>
                <p className='text-lg font-mono mt-1 text-foreground'>:{status?.ports?.postgres || '-'}</p>
              </div>
              <div className='w-12 h-12 bg-brand-500/20 rounded-xl flex items-center justify-center'>
                <HardDrive className='w-6 h-6 text-brand-400' />
              </div>
            </div>
          </div>

          <div className='glass-card p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>Studio</p>
                <p className='text-lg font-mono mt-1 text-foreground'>:{status?.ports?.studio || '-'}</p>
              </div>
              <div className='w-12 h-12 bg-brand-500/20 rounded-xl flex items-center justify-center'>
                <Activity className='w-6 h-6 text-brand-400' />
              </div>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className='bg-card border rounded-lg p-6 mb-8'>
          <h2 className='text-xl font-semibold mb-6 flex items-center gap-2'>
            <Server className='w-5 h-5' />
            Shared Services
          </h2>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {status?.services.map((service) => {
              const isRunning = service.status === 'running';
              const isHealthy = service.health === 'healthy';
              return (
                <div
                  key={service.name}
                  className={`p-4 rounded-lg border ${
                    isRunning
                      ? isHealthy
                        ? 'border-brand-500/30 bg-brand-500/5'
                        : 'border-yellow-500/30 bg-yellow-500/5'
                      : 'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  <div className='flex items-center justify-between mb-2'>
                    <span className='font-medium text-foreground'>
                      {service.name.replace('multibase-', '')}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        isRunning
                          ? isHealthy
                            ? 'bg-brand-500/20 text-brand-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? (isHealthy ? 'bg-brand-400' : 'bg-yellow-400') : 'bg-red-400'}`} />
                      {isRunning ? (isHealthy ? 'Healthy' : 'Running') : 'Stopped'}
                    </span>
                  </div>
                  {service.cpu !== undefined && (
                    <div className='text-xs text-muted-foreground'>
                      CPU: {service.cpu.toFixed(1)}% · Memory: {service.memory?.toFixed(0)} MB
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Database Cluster */}
        <div className='bg-card border rounded-lg p-6'>
          <h2 className='text-xl font-semibold mb-6 flex items-center gap-2'>
            <Database className='w-5 h-5' />
            Datenbank-Cluster
            <span className='text-sm font-normal text-muted-foreground ml-2'>
              ({dbData?.count || 0} Projekt-Datenbanken)
            </span>
          </h2>

          {dbData && dbData.databases.length > 0 ? (
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-white/10'>
                    <th className='text-left py-3 px-4 text-sm font-medium text-muted-foreground'>Datenbank</th>
                    <th className='text-left py-3 px-4 text-sm font-medium text-muted-foreground'>Projekt</th>
                    <th className='text-left py-3 px-4 text-sm font-medium text-muted-foreground'>Größe</th>
                    <th className='text-right py-3 px-4 text-sm font-medium text-muted-foreground'>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {dbData.databases.map((db) => (
                    <tr key={db.name} className='border-b border-white/5 hover:bg-white/5 transition-colors'>
                      <td className='py-3 px-4 font-mono text-sm text-foreground'>{db.name}</td>
                      <td className='py-3 px-4 text-sm text-muted-foreground'>{db.projectName}</td>
                      <td className='py-3 px-4 text-sm text-muted-foreground'>{db.sizeFormatted}</td>
                      <td className='py-3 px-4 text-right'>
                        {deleteTarget === db.projectName ? (
                          <div className='flex items-center justify-end gap-2'>
                            <button
                              onClick={() => {
                                deleteMutation.mutate(db.projectName);
                                setDeleteTarget(null);
                              }}
                              className='text-xs px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30'
                            >
                              Bestätigen
                            </button>
                            <button
                              onClick={() => setDeleteTarget(null)}
                              className='text-xs px-3 py-1 bg-white/10 text-muted-foreground rounded hover:bg-white/20'
                            >
                              Abbrechen
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteTarget(db.projectName)}
                            className='text-muted-foreground hover:text-red-400 transition-colors'
                            title='Datenbank löschen'
                          >
                            <Trash2 className='w-4 h-4' />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className='text-center py-12'>
              <Database className='w-12 h-12 text-muted-foreground/30 mx-auto mb-4' />
              <p className='text-muted-foreground'>Noch keine Projekt-Datenbanken vorhanden</p>
              <p className='text-sm text-muted-foreground/70 mt-1'>
                Erstelle eine Cloud-Instanz, um automatisch eine Datenbank anzulegen
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
