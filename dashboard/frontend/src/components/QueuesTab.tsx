import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queuesApi } from '../lib/api';
import { ListOrdered, Plus, Trash2, RefreshCw, Loader2, Send, Zap } from 'lucide-react';
import { toast } from 'sonner';
import CreateQueueModal from './CreateQueueModal';

interface QueuesTabProps {
  instanceName: string;
}

export default function QueuesTab({ instanceName }: QueuesTabProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [sendMessageText, setSendMessageText] = useState('{"key":"value"}');
  const [showSendForm, setShowSendForm] = useState(false);

  const { data: statusData, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['queue-status', instanceName],
    queryFn: () => queuesApi.getStatus(instanceName),
  });

  const { data: queuesData, isLoading: isLoadingQueues, refetch } = useQuery({
    queryKey: ['queues', instanceName],
    queryFn: () => queuesApi.list(instanceName),
  });

  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['queue-messages', instanceName, selectedQueue],
    queryFn: () => queuesApi.readMessages(instanceName, selectedQueue!, 20),
    enabled: !!selectedQueue,
    refetchInterval: 5000,
  });

  const enableMutation = useMutation({
    mutationFn: () => queuesApi.enable(instanceName),
    onSuccess: () => {
      toast.success('pgmq extension enabled');
      queryClient.invalidateQueries({ queryKey: ['queue-status', instanceName] });
      queryClient.invalidateQueries({ queryKey: ['queues', instanceName] });
    },
    onError: (error: any) => toast.error('Failed to enable pgmq', { description: error.message }),
  });

  const dropMutation = useMutation({
    mutationFn: (queueName: string) => queuesApi.drop(instanceName, queueName),
    onSuccess: (_, queueName) => {
      toast.success(`Queue "${queueName}" deleted`);
      if (selectedQueue === queueName) setSelectedQueue(null);
      queryClient.invalidateQueries({ queryKey: ['queues', instanceName] });
    },
    onError: (error: any) => toast.error('Failed to delete queue', { description: error.message }),
  });

  const purgeMutation = useMutation({
    mutationFn: (queueName: string) => queuesApi.purge(instanceName, queueName),
    onSuccess: (data, queueName) => {
      toast.success(`Queue "${queueName}" purged (${data.deleted} messages deleted)`);
      queryClient.invalidateQueries({ queryKey: ['queue-messages', instanceName, queueName] });
    },
    onError: (error: any) => toast.error('Failed to purge queue', { description: error.message }),
  });

  const sendMutation = useMutation({
    mutationFn: () => {
      let parsed: object;
      try {
        parsed = JSON.parse(sendMessageText);
      } catch {
        throw new Error('Message must be valid JSON');
      }
      return queuesApi.sendMessage(instanceName, selectedQueue!, parsed);
    },
    onSuccess: (data) => {
      toast.success(`Message sent (ID: ${data.msgId})`);
      setSendMessageText('{"key":"value"}');
      setShowSendForm(false);
      queryClient.invalidateQueries({ queryKey: ['queue-messages', instanceName, selectedQueue] });
    },
    onError: (error: any) => toast.error('Failed to send message', { description: error.message }),
  });

  const isEnabled = statusData?.enabled === true || queuesData?.enabled === true;
  const queues = queuesData?.queues ?? [];
  const messages = messagesData?.messages ?? [];

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold flex items-center gap-2'>
            <ListOrdered className='w-5 h-5 text-primary' />
            Message Queues (pgmq)
          </h3>
          <p className='text-sm text-muted-foreground mt-0.5'>
            Postgres-native message queues for background tasks and event-driven workflows.
          </p>
        </div>
        <div className='flex gap-2'>
          <button
            onClick={() => refetch()}
            className='p-2 hover:bg-secondary rounded-md transition-colors'
          >
            <RefreshCw className='w-4 h-4' />
          </button>
          {isEnabled && (
            <button
              onClick={() => setShowCreateModal(true)}
              className='flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm'
            >
              <Plus className='w-4 h-4' />
              New Queue
            </button>
          )}
        </div>
      </div>

      {/* Extension not installed */}
      {isLoadingStatus ? (
        <div className='flex justify-center p-12'>
          <Loader2 className='w-6 h-6 animate-spin text-primary' />
        </div>
      ) : !isEnabled ? (
        <div className='flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg'>
          <ListOrdered className='w-10 h-10 text-muted-foreground mb-3' />
          <p className='text-sm font-medium mb-1'>pgmq is not installed</p>
          <p className='text-xs text-muted-foreground mb-4'>
            Enable the pgmq extension to use Postgres-native message queues.
          </p>
          <button
            onClick={() => enableMutation.mutate()}
            disabled={enableMutation.isPending}
            className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50'
          >
            {enableMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Zap className='w-4 h-4' />}
            Enable pgmq
          </button>
        </div>
      ) : (
        <div className='flex flex-col lg:flex-row gap-4 lg:gap-6'>
          {/* Queue List */}
          <div className='w-full lg:w-1/3 border border-border rounded-lg flex flex-col'>
            <div className='p-3 border-b border-border'>
              <p className='text-sm font-medium'>Queues ({queues.length})</p>
            </div>
            {isLoadingQueues ? (
              <div className='flex justify-center p-8'>
                <Loader2 className='w-5 h-5 animate-spin text-primary' />
              </div>
            ) : queues.length === 0 ? (
              <div className='flex flex-col items-center justify-center p-8 text-center'>
                <p className='text-sm text-muted-foreground mb-3'>No queues yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className='flex items-center gap-1.5 text-xs text-primary hover:underline'
                >
                  <Plus className='w-3.5 h-3.5' />
                  Create your first queue
                </button>
              </div>
            ) : (
              <div className='divide-y divide-border flex-1 overflow-auto'>
                {queues.map((q: any) => (
                  <div
                    key={q.queue_name}
                    onClick={() => setSelectedQueue(q.queue_name)}
                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedQueue === q.queue_name ? 'bg-primary/10 border-l-2 border-primary' : ''
                    }`}
                  >
                    <div>
                      <p className='text-sm font-medium'>{q.queue_name}</p>
                      {q.created_at && (
                        <p className='text-xs text-muted-foreground'>
                          {new Date(q.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete queue "${q.queue_name}"? All messages will be lost.`)) {
                          dropMutation.mutate(q.queue_name);
                        }
                      }}
                      className='p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors opacity-0 group-hover:opacity-100'
                    >
                      <Trash2 className='w-3.5 h-3.5' />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Queue Detail */}
          <div className='flex-1 border border-border rounded-lg'>
            {!selectedQueue ? (
              <div className='flex flex-col items-center justify-center h-full min-h-[200px] text-center p-8'>
                <ListOrdered className='w-8 h-8 text-muted-foreground mb-3' />
                <p className='text-sm text-muted-foreground'>Select a queue to inspect its messages</p>
              </div>
            ) : (
              <div className='flex flex-col h-full'>
                {/* Queue header */}
                <div className='flex items-center justify-between p-3 border-b border-border'>
                  <h4 className='font-medium text-sm'>{selectedQueue}</h4>
                  <div className='flex gap-2'>
                    <button
                      onClick={() => setShowSendForm(!showSendForm)}
                      className='flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs transition-colors'
                    >
                      <Send className='w-3.5 h-3.5' />
                      Send Message
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Purge all messages from "${selectedQueue}"?`)) {
                          purgeMutation.mutate(selectedQueue);
                        }
                      }}
                      className='flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md text-xs transition-colors'
                    >
                      <Trash2 className='w-3.5 h-3.5' />
                      Purge
                    </button>
                  </div>
                </div>

                {/* Send form */}
                {showSendForm && (
                  <div className='p-3 border-b border-border bg-muted/20 space-y-2'>
                    <label className='text-xs font-medium'>Message (JSON)</label>
                    <textarea
                      className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono resize-none'
                      rows={3}
                      value={sendMessageText}
                      onChange={(e) => setSendMessageText(e.target.value)}
                    />
                    <div className='flex justify-end gap-2'>
                      <button
                        onClick={() => setShowSendForm(false)}
                        className='px-3 py-1.5 rounded-md hover:bg-secondary transition-colors text-xs'
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => sendMutation.mutate()}
                        disabled={sendMutation.isPending}
                        className='flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-xs disabled:opacity-50'
                      >
                        {sendMutation.isPending ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <Send className='w-3.5 h-3.5' />}
                        Send
                      </button>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className='flex-1 overflow-auto'>
                  {isLoadingMessages ? (
                    <div className='flex justify-center p-8'>
                      <Loader2 className='w-5 h-5 animate-spin text-primary' />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className='flex flex-col items-center justify-center p-8 text-center'>
                      <p className='text-sm text-muted-foreground'>Queue is empty</p>
                      <p className='text-xs text-muted-foreground mt-1'>Auto-refreshes every 5 seconds</p>
                    </div>
                  ) : (
                    <div className='divide-y divide-border'>
                      {messages.map((msg: any) => (
                        <div key={msg.msg_id} className='p-3 hover:bg-muted/30 space-y-1'>
                          <div className='flex items-center justify-between'>
                            <span className='text-xs text-muted-foreground font-mono'>#{msg.msg_id}</span>
                            <div className='flex gap-2 text-xs text-muted-foreground'>
                              <span>read {msg.read_ct}x</span>
                              {msg.enqueued_at && (
                                <span>{new Date(msg.enqueued_at).toLocaleTimeString()}</span>
                              )}
                            </div>
                          </div>
                          <pre className='text-xs font-mono bg-muted rounded p-2 overflow-auto max-h-24'>
                            {typeof msg.message === 'object'
                              ? JSON.stringify(msg.message, null, 2)
                              : String(msg.message)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateQueueModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(queueName) => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['queues', instanceName] });
            setSelectedQueue(queueName);
            toast.success(`Queue "${queueName}" created`);
          }}
          instanceName={instanceName}
        />
      )}
    </div>
  );
}
