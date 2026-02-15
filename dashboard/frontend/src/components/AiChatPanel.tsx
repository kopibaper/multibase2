import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Paperclip,
} from 'lucide-react';
import {
  useAiChat,
  useAiSessions,
  useCreateAiSession,
  useDeleteAiSession,
  useAiSessionMessages,
  useAiKeyStatus,
  useAiModels,
} from '../hooks/useAiAgent';
import type { AiMessage, ToolCall, ToolResult } from '../hooks/useAiAgent';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

// ============================================================
// Tool Result Card
// ============================================================

function ToolResultCard({ result }: { result: ToolResult }) {
  const isError = !!result.result?.error;

  return (
    <div className='mt-2 mb-2'>
      <div className={`text-xs flex items-center gap-1.5 mb-1 ${isError ? 'text-red-400' : 'text-green-400'}`}>
        {isError ? <AlertTriangle className='w-3 h-3' /> : <CheckCircle2 className='w-3 h-3' />}
        <span className='font-medium uppercase tracking-wider opacity-80'>{result.name.replace(/_/g, ' ')}</span>
      </div>
      <div className='bg-black/40 rounded border border-white/5 p-2 font-mono text-xs text-muted-foreground overflow-x-auto'>
        {isError ? result.result.error : JSON.stringify(result.result, null, 2)}
      </div>
    </div>
  );
}

function BatchConfirmationCard({
  toolCalls,
  onConfirm,
  onCancel,
  isLoading,
}: {
  toolCalls: ToolCall[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [isConfirmed, setIsConfirmed] = useState(false);

  return (
    <div className='mt-3 mb-3'>
      <div className='bg-yellow-500/10 border border-yellow-500/20 rounded-lg overflow-hidden'>
        <div className='bg-yellow-500/10 px-3 py-2 border-b border-yellow-500/10 flex items-center gap-2'>
          <AlertTriangle className='w-4 h-4 text-yellow-500' />
          <span className='text-xs font-semibold text-yellow-200 uppercase tracking-wider'>
            Confirmation Required ({toolCalls.length} Actions)
          </span>
        </div>
        <div className='p-3'>
          <p className='text-sm text-yellow-100/90 mb-3'>The assistant wants to execute the following actions:</p>

          <div className='space-y-2 mb-4 max-h-40 overflow-y-auto pr-1 custom-scrollbar'>
            {toolCalls.map((tc) => (
              <div key={tc.id} className='bg-black/20 rounded p-2 text-xs border border-white/5'>
                <div className='font-medium text-yellow-300/90 mb-1'>{tc.name}</div>
                <pre className='font-mono text-muted-foreground whitespace-pre-wrap break-all'>
                  {JSON.stringify(tc.arguments, null, 2)}
                </pre>
              </div>
            ))}
          </div>

          <div className='mt-3 mb-3 flex items-center gap-2'>
            <button
              type='button'
              onClick={() => setIsConfirmed(!isConfirmed)}
              className='flex items-center gap-2 group cursor-pointer'
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isConfirmed ? 'bg-yellow-500 border-yellow-500' : 'bg-transparent border-yellow-500/50 group-hover:border-yellow-500'}`}
              >
                {isConfirmed && <CheckCircle2 className='w-3 h-3 text-black' />}
              </div>
              <span className='text-xs text-yellow-200/90 select-none'>
                I confirm I want to execute these {toolCalls.length} actions
              </span>
            </button>
          </div>

          <div className='flex gap-2'>
            <button
              onClick={onConfirm}
              disabled={isLoading || !isConfirmed}
              className='px-3 py-1.5 text-xs font-medium bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-1 justify-center'
            >
              {isLoading ? <Loader2 className='w-3 h-3 animate-spin' /> : <CheckCircle2 className='w-3 h-3' />}
              Accept All
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className='px-3 py-1.5 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-1 justify-center'
            >
              <X className='w-3 h-3' />
              Reject All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Chat Message
// ============================================================

function ChatMessage({
  message,
  pendingToolCalls,
  toolResults,
  onConfirmBatch,
  onCancelBatch,
  isConfirming,
}: {
  message: AiMessage;
  pendingToolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  onConfirmBatch?: (toolCalls: ToolCall[]) => void;
  onCancelBatch?: (toolCalls: ToolCall[]) => void;
  isConfirming?: boolean;
}) {
  if (message.role === 'user') {
    return (
      <div className='flex justify-end mb-3'>
        <div className='max-w-[80%] bg-brand-500/20 border border-brand-500/30 rounded-2xl rounded-br-md px-3 py-2'>
          <p className='text-sm text-foreground whitespace-pre-wrap'>{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    return (
      <div className='flex justify-start mb-3'>
        <div className='max-w-[85%]'>
          <div className='flex items-start gap-2'>
            <div className='w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5'>
              <Sparkles className='w-3.5 h-3.5 text-purple-400' />
            </div>
            <div className='flex-1 min-w-0'>
              <div className='bg-white/5 border border-white/10 rounded-2xl rounded-tl-md px-3 py-2'>
                <div className='text-sm text-foreground whitespace-pre-wrap ai-markdown'>
                  {renderMarkdown(message.content)}
                </div>
              </div>
              {/* Tool Results from history */}
              {message.toolResults?.map((tr, i) => (
                <ToolResultCard key={i} result={tr} />
              ))}

              {/* Batch Confirmation for Pending Tools */}
              {pendingToolCalls && pendingToolCalls.length > 0 && (
                <BatchConfirmationCard
                  toolCalls={pendingToolCalls}
                  onConfirm={() => onConfirmBatch?.(pendingToolCalls)}
                  onCancel={() => onCancelBatch?.(pendingToolCalls)}
                  isLoading={!!isConfirming}
                />
              )}

              {/* Completed tool results */}
              {toolResults?.map((tr, i) => (
                <ToolResultCard key={`result-${i}`} result={tr} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Simple markdown renderer (bold, code, lists)
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className='font-semibold text-foreground mt-2 mb-1'>
          {line.slice(4)}
        </h4>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className='font-semibold text-foreground mt-2 mb-1'>
          {line.slice(3)}
        </h3>
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={i} className='font-bold text-foreground mt-2 mb-1'>
          {line.slice(2)}
        </h2>
      );
      continue;
    }

    // List items
    if (line.match(/^[-*] /)) {
      elements.push(
        <div key={i} className='flex items-start gap-1.5 ml-1'>
          <span className='text-muted-foreground mt-1'>•</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const match = line.match(/^(\d+)\. (.*)/);
      if (match) {
        elements.push(
          <div key={i} className='flex items-start gap-1.5 ml-1'>
            <span className='text-muted-foreground'>{match[1]}.</span>
            <span>{formatInline(match[2])}</span>
          </div>
        );
        continue;
      }
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} className='h-1' />);
      continue;
    }

    // Regular paragraph
    elements.push(<p key={i}>{formatInline(line)}</p>);
  }

  return <>{elements}</>;
}

function formatInline(text: string): React.ReactNode {
  // Split by code and bold markers
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Code: `text`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`/);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{formatBold(codeMatch[1])}</span>);
      parts.push(
        <code key={key++} className='px-1 py-0.5 bg-white/10 rounded text-purple-300 text-[0.85em]'>
          {codeMatch[2]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // No more matches
    parts.push(<span key={key++}>{formatBold(remaining)}</span>);
    break;
  }

  return <>{parts}</>;
}

function formatBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/);
  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 0 ? (
          <span key={i}>{part}</span>
        ) : (
          <strong key={i} className='font-semibold text-foreground'>
            {part}
          </strong>
        )
      )}
    </>
  );
}

// ============================================================
// Session Sidebar
// ============================================================

function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isCreating,
}: {
  sessions: any[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isCreating: boolean;
}) {
  return (
    <div className='border-b border-white/10 px-2 py-2'>
      <div className='flex items-center gap-1 mb-2'>
        <button
          onClick={onNewSession}
          disabled={isCreating}
          className='flex items-center gap-1.5 flex-1 px-2 py-1.5 text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-brand-400 rounded-lg transition-colors disabled:opacity-50'
        >
          {isCreating ? <Loader2 className='w-3 h-3 animate-spin' /> : <Plus className='w-3 h-3' />}
          New Chat
        </button>
      </div>
      <div className='max-h-32 overflow-y-auto space-y-0.5 scrollbar-thin'>
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`group flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
              session.id === activeSessionId
                ? 'bg-white/10 text-foreground'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            }`}
            onClick={() => onSelectSession(session.id)}
          >
            <MessageSquare className='w-3 h-3 flex-shrink-0' />
            <span className='flex-1 truncate'>{session.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(session.id);
              }}
              className='opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all'
            >
              <Trash2 className='w-3 h-3' />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main Chat Panel
// ============================================================

export default function AiChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { data: keyStatus } = useAiKeyStatus();
  const { data: sessions = [] } = useAiSessions();
  const createSession = useCreateAiSession();
  const deleteSession = useDeleteAiSession();
  const { data: messages = [] } = useAiSessionMessages(activeSessionId);
  const { sendMessage, confirmBatchTools, isStreaming, streamingMessage, pendingToolCalls, toolResults } = useAiChat();
  const { data: models = [] } = useAiModels();
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Set default model
  useEffect(() => {
    if (models.length > 0 && !selectedModel && keyStatus) {
      // If configured model is in list, use it, otherwise first one
      const configuredConfig = models.find((m) => m.id === keyStatus.model);
      if (configuredConfig) {
        setSelectedModel(configuredConfig.id);
      } else {
        setSelectedModel(models[0].id);
      }
    }
  }, [models, keyStatus, selectedModel]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage, pendingToolCalls, toolResults]);

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Select first session on load
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        toast.error('File size exceeds 5MB limit');
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && !selectedFile) || isStreaming) return;

    let sid = activeSessionId;

    // Auto-create session if none
    if (!sid) {
      try {
        const session = await createSession.mutateAsync();
        setActiveSessionId(session.id);
        sid = session.id;
      } catch {
        toast.error('Failed to create chat session');
        return;
      }
    }

    const msg = inputValue.trim();
    const fileToSend = selectedFile;

    setInputValue('');
    handleRemoveFile(); // Clear file after sending

    // TODO: Update sendMessage to handle file
    // For now we just send text
    if (fileToSend) {
      // Convert to base64 or just pass file object if sendMessage supports it
      // We will update useAiChat next.
      // We will update useAiChat next.
      sendMessage(sid, msg, fileToSend, selectedModel);
    } else {
      sendMessage(sid, msg, undefined, selectedModel);
    }
  };

  const handleNewSession = async () => {
    try {
      const session = await createSession.mutateAsync();
      setActiveSessionId(session.id);
    } catch {
      toast.error('Failed to create session');
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession.mutateAsync(id);
      if (activeSessionId === id) {
        setActiveSessionId(sessions.find((s) => s.id !== id)?.id || null);
      }
    } catch {
      toast.error('Failed to delete session');
    }
  };

  const handleBatchConfirm = async (toolCalls: ToolCall[]) => {
    if (!activeSessionId) return;
    try {
      await confirmBatchTools(activeSessionId, toolCalls);
      toast.success(`${toolCalls.length} actions confirmed`);
    } catch {
      toast.error('Batch execution failed');
    }
  };

  const handleBatchCancel = (_toolCalls: ToolCall[]) => {
    // Just remove from pending visually - relying on new state from hook would be better but for now just toast
    toast.info('Batch action cancelled');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isConfigured = keyStatus?.configured;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className='fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/25 flex items-center justify-center hover:scale-110 transition-all duration-300 group'
        >
          <Sparkles className='w-6 h-6 text-white' />
          <span className='absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-background animate-pulse' />
        </button>
      )}

      {/* Chat Sidebar (Drawer) */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[500px] max-w-full flex flex-col border-l border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className='flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-white/5'>
          <div className='w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20'>
            <Sparkles className='w-5 h-5 text-white' />
          </div>
          <div className='flex-1'>
            <h3 className='text-base font-semibold text-foreground'>AI Assistant</h3>
            <p className='text-xs text-muted-foreground'>
              {isConfigured ? `${keyStatus.provider?.toUpperCase()} connected` : 'Not configured'}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className='p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Not configured state */}
        {!isConfigured && (
          <div className='flex-1 flex items-center justify-center p-8'>
            <div className='text-center max-w-md'>
              <div className='w-20 h-20 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-6'>
                <Sparkles className='w-10 h-10 text-purple-400' />
              </div>
              <h4 className='text-lg font-semibold text-foreground mb-3'>Set Up AI Assistant</h4>
              <p className='text-sm text-muted-foreground mb-6 leading-relaxed'>
                To use the AI assistant, please add an API key from OpenAI, Gemini, or Anthropic in your profile
                settings.
              </p>
              <Link
                to='/profile'
                onClick={() => setIsOpen(false)}
                className='inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded-lg transition-colors'
              >
                <Settings className='w-4 h-4' />
                Go to Profile
              </Link>
            </div>
          </div>
        )}

        {/* Configured state */}
        {isConfigured && (
          <div className='flex flex-col h-full overflow-hidden'>
            {/* Session Sidebar (Top bar in this layout, or expandable?)
                For a sidebar layout, maybe we want the sessions to be a collapsible drawer or updated SessionSidebar?
                The existing SessionSidebar component was horizontal-ish list.
                Let's keep it as is for now, but maybe styling tweaks.
             */}
            <SessionSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={setActiveSessionId}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
              isCreating={createSession.isPending}
            />

            {/* Messages */}
            <div className='flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin'>
              {messages.length === 0 && !streamingMessage && (
                <div className='flex items-center justify-center h-full text-center opacity-60'>
                  <div className='max-w-xs'>
                    <Sparkles className='w-12 h-12 text-purple-400/40 mx-auto mb-4' />
                    <h4 className='text-sm font-medium text-foreground mb-1'>How can I help you?</h4>
                    <p className='text-xs text-muted-foreground mb-4'>
                      I can help you manage instances, check metrics, and run tasks.
                    </p>
                    <div className='flex flex-col gap-2'>
                      {['Show system status', 'List all instances', 'Create a database backup'].map((q) => (
                        <button
                          key={q}
                          onClick={() => setInputValue(q)}
                          className='px-3 py-2 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors text-left'
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => {
                const isLast = i === messages.length - 1;
                // If this is the last message and it's from assistant, and we're NOT streaming
                // (or even if we are, maybe we want to show pending calls on the last stable message?)
                // Actually, if we are NOT streaming, but have pending calls, they belong to the last assistant message.
                const showPendingCalls =
                  isLast && msg.role === 'assistant' && !isStreaming && pendingToolCalls.length > 0;

                return (
                  <ChatMessage
                    key={msg.id || i}
                    message={msg}
                    pendingToolCalls={showPendingCalls ? pendingToolCalls : undefined}
                    onConfirmBatch={handleBatchConfirm}
                    onCancelBatch={handleBatchCancel}
                    isConfirming={isStreaming}
                  />
                );
              })}

              {/* Current streaming message */}
              {isStreaming && streamingMessage && (
                <ChatMessage
                  message={{ role: 'assistant', content: streamingMessage }}
                  pendingToolCalls={pendingToolCalls}
                  toolResults={toolResults}
                  onConfirmBatch={handleBatchConfirm}
                  onCancelBatch={handleBatchCancel}
                  isConfirming={isStreaming}
                />
              )}

              {/* Loading indicator */}
              {isStreaming && !streamingMessage && (
                <div className='flex justify-start mb-3'>
                  <div className='flex items-center gap-2'>
                    <div className='w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center'>
                      <Sparkles className='w-4 h-4 text-purple-400' />
                    </div>
                    <div className='flex gap-1.5 p-2 bg-white/5 rounded-lg'>
                      <div
                        className='w-2 h-2 rounded-full bg-purple-400/60 animate-bounce'
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className='w-2 h-2 rounded-full bg-purple-400/60 animate-bounce'
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className='w-2 h-2 rounded-full bg-purple-400/60 animate-bounce'
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className='p-4 border-t border-white/10 bg-white/[0.02]'>
              {/* File Preview */}
              {selectedFile && (
                <div className='mb-3 flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-2 max-w-max'>
                  {previewUrl ? (
                    <div className='relative w-12 h-12 rounded overflow-hidden border border-white/10 group'>
                      <img src={previewUrl} alt='Preview' className='w-full h-full object-cover' />
                    </div>
                  ) : (
                    <div className='w-12 h-12 rounded bg-white/10 flex items-center justify-center'>
                      <Paperclip className='w-5 h-5 text-muted-foreground' />
                    </div>
                  )}
                  <div className='flex flex-col'>
                    <span className='text-xs font-medium text-foreground truncate max-w-[150px]'>
                      {selectedFile.name}
                    </span>
                    <span className='text-[10px] text-muted-foreground'>
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    type='button'
                    onClick={handleRemoveFile}
                    className='p-1 hover:bg-white/10 rounded-full text-muted-foreground hover:text-red-400 transition-colors ml-1'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </div>
              )}

              <div className='relative flex items-end gap-2'>
                <input
                  type='file'
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className='hidden'
                  accept='image/*,.pdf,.txt,.md,.json,.js,.ts,.tsx,.css,.html'
                />

                <button
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                  className='absolute left-3 bottom-3 p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-brand-400 transition-colors disabled:opacity-50'
                  title='Attach file'
                >
                  <Paperclip className='w-5 h-5' />
                </button>

                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder='Ask AI Agent...'
                  rows={1}
                  disabled={isStreaming}
                  className='w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none disabled:opacity-50 min-h-[50px] max-h-32 shadow-inner'
                />
                <button
                  type='submit'
                  disabled={(!inputValue.trim() && !selectedFile) || isStreaming}
                  className='absolute right-2 bottom-2 p-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-30 disabled:hover:bg-purple-500 transition-colors shadow-lg shadow-purple-500/20'
                >
                  {isStreaming ? <Loader2 className='w-4 h-4 animate-spin' /> : <Send className='w-4 h-4' />}
                </button>
              </div>
              <div className='flex justify-between items-center mt-2 px-1'>
                {/* Model Selector */}
                {(keyStatus?.provider === 'openrouter' || models.length > 0) && (
                  <div className='flex items-center gap-2'>
                    <span className='text-[10px] text-muted-foreground/50'>Model:</span>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className='bg-transparent text-[10px] text-muted-foreground border-none focus:ring-0 cursor-pointer hover:text-foreground transition-colors max-w-[200px] truncate py-0 pl-0'
                      disabled={isStreaming}
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id} className='bg-popover text-popover-foreground'>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <p className='text-[10px] text-muted-foreground/40 ml-auto'>
                  AI can make mistakes. Please verify important information.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
