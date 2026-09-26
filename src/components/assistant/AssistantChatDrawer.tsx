import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Bot, 
  User, 
  Check, 
  Loader2, 
  Wrench, 
  ArrowRight, 
  FileCode,
  Zap,
  Sliders,
  Sparkles,
  HelpCircle,
  Globe,
  Link2,
  ExternalLink,
  Plus,
  Trash2
} from 'lucide-react';
import { ModelArchitectureSpec } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { MarkdownMessage } from './MarkdownMessage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  webReferences?: string[];
  referencedSources?: Array<{ url: string; title: string }>;
  action?: {
    action: string;
    summary: string;
    updatedSpec?: ModelArchitectureSpec;
  } | null;
  applied?: boolean;
}

interface AssistantChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpec: ModelArchitectureSpec;
  onApplySpec: (updatedSpec: ModelArchitectureSpec) => void;
}

const PRESET_WEB_REFERENCES = [
  { label: 'Llama 3 Paper', url: 'https://arxiv.org/abs/2407.21783' },
  { label: 'FlashAttention-3', url: 'https://arxiv.org/abs/2407.08608' },
  { label: 'DeepSeek-V3 MoE', url: 'https://arxiv.org/abs/2412.19437' },
  { label: 'PyTorch GQA Docs', url: 'https://pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html' }
];

export const AssistantChatDrawer: React.FC<AssistantChatDrawerProps> = ({
  isOpen,
  onClose,
  currentSpec,
  onApplySpec
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init_1',
      role: 'assistant',
      content: `Hello, I am GraphFlow Copilot. I have loaded the active architecture specification for **${currentSpec.name}** (${(currentSpec.summary.totalParameters / 1e9).toFixed(1)}B parameters).

I can analyze tensor dimensions, identify memory-bandwidth bottlenecks, reconfigure attention/MoE hyperparameters, or modify the architecture graph directly as per your instructions.

💡 **Tip:** You can attach reference webpage URLs (e.g. arXiv papers, PyTorch docs, GitHub specs) using the **Globe** button below, and I will ground my engineering analysis directly on the source material.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Webpage Reference Attachment State
  const [attachedLinks, setAttachedLinks] = useState<string[]>([]);
  const [isLinkInputOpen, setIsLinkInputOpen] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isLinkInputOpen) {
      setTimeout(() => linkInputRef.current?.focus(), 50);
    }
  }, [isLinkInputOpen]);

  const handleAddLink = (urlToAdd?: string) => {
    const raw = (urlToAdd || linkInputValue).trim();
    if (!raw) return;

    let normalized = raw;
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }

    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname || !parsed.hostname.includes('.')) {
        setLinkError('Please enter a valid URL (e.g. arxiv.org/abs/...)');
        return;
      }
    } catch {
      setLinkError('Invalid URL format');
      return;
    }

    if (attachedLinks.includes(normalized)) {
      setLinkError('This webpage is already attached');
      return;
    }

    setAttachedLinks(prev => [...prev, normalized]);
    setLinkInputValue('');
    setLinkError(null);
    setIsLinkInputOpen(false);
  };

  const handleRemoveLink = (url: string) => {
    setAttachedLinks(prev => prev.filter(u => u !== url));
  };

  const handleSend = async (textToSend?: string) => {
    const prompt = textToSend || input;
    if (!prompt.trim() || loading) return;

    const activeWebReferences = [...attachedLinks];

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: prompt.trim(),
      webReferences: activeWebReferences.length > 0 ? activeWebReferences : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!textToSend) setInput('');
    setAttachedLinks([]);
    setIsLinkInputOpen(false);
    setLinkError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          currentModelSpec: currentSpec,
          webReferences: activeWebReferences
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      const assistantMsg: Message = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'No response generated.',
        action: data.action,
        referencedSources: data.referencedSources,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Failed to chat with assistant:', err);
      const errorMsg: Message = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `**Error:** Unable to process request.\n\n*${err.message || 'Check server connection.'}*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAction = (msgId: string, updatedSpec: ModelArchitectureSpec) => {
    onApplySpec(updatedSpec);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, applied: true } : m));
  };

  const quickPrompts = [
    'Diagnose dimension mismatches in this model',
    'Convert attention to Grouped Query Attention (GQA)',
    'Optimize architecture to fit on a single H100 (80GB)',
    'Explain the arithmetic intensity and memory wall'
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
      <div 
        className={`w-full max-w-lg h-full border-l shadow-2xl flex flex-col transition-all overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className={`p-3.5 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              isDark ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-sky-50 border-sky-200 text-sky-600'
            }`}>
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold">GraphFlow Copilot</h3>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                  isDark ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  Online
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Active Model: {currentSpec.name}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((msg) => (
            <div 
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-sky-400' : 'bg-slate-100 border-slate-200 text-sky-600'
                }`}>
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-sky-600 text-white rounded-tr-xs'
                  : isDark 
                  ? 'bg-slate-800/80 border border-slate-700/70 text-slate-200 rounded-tl-xs shadow-md'
                  : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs shadow-xs'
              }`}>
                {/* Formatted Markdown Content */}
                {msg.role === 'assistant' ? (
                  <MarkdownMessage content={msg.content} isDark={isDark} />
                ) : (
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.content}
                  </div>
                )}

                {/* Attached Web References in User Message */}
                {msg.webReferences && msg.webReferences.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-sky-400/30">
                    {msg.webReferences.map((refUrl, i) => {
                      let hostname = refUrl;
                      try { hostname = new URL(refUrl).hostname.replace('www.', ''); } catch {}
                      return (
                        <a
                          key={i}
                          href={refUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-700/90 text-sky-100 hover:bg-sky-800 transition-colors"
                          title={refUrl}
                        >
                          <Globe className="w-2.5 h-2.5 text-sky-300" />
                          <span className="truncate max-w-[140px]">{hostname}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-75" />
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Referenced Sources in Assistant Response */}
                {msg.referencedSources && msg.referencedSources.length > 0 && (
                  <div className={`mt-2.5 pt-2 border-t flex flex-wrap items-center gap-1.5 text-[10px] font-mono ${
                    isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                  }`}>
                    <span className="flex items-center gap-1 text-sky-400 font-semibold">
                      <Globe className="w-3 h-3 text-sky-400" />
                      Grounded References:
                    </span>
                    {msg.referencedSources.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
                          isDark 
                            ? 'border-slate-700 bg-slate-900 text-slate-300 hover:text-sky-300 hover:border-sky-500' 
                            : 'border-slate-300 bg-white text-slate-700 hover:text-sky-700 hover:border-sky-400'
                        }`}
                        title={s.url}
                      >
                        <span className="truncate max-w-[150px]">{s.title || s.url}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-75" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Proposed Action Card */}
                {msg.action && msg.action.updatedSpec && (
                  <div className={`mt-3 p-2.5 rounded-xl border text-[11px] ${
                    isDark ? 'bg-slate-900 border-sky-500/40 text-slate-200' : 'bg-white border-sky-400 text-slate-800 shadow-xs'
                  }`}>
                    <div className="flex items-center gap-1.5 text-sky-500 font-semibold mb-1">
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Proposed Architecture Mutation</span>
                    </div>
                    <p className={`mb-2 font-mono text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {msg.action.summary || 'Architecture parameters updated'}
                    </p>

                    <button
                      disabled={msg.applied}
                      onClick={() => handleApplyAction(msg.id, msg.action!.updatedSpec!)}
                      className={`w-full py-1.5 px-2 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                        msg.applied
                          ? 'bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 cursor-default'
                          : 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                      }`}
                    >
                      {msg.applied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Applied to Architecture
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-3.5 h-3.5" />
                          Apply Changes to Graph
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className={`text-[9px] mt-1.5 font-mono text-right ${
                  msg.role === 'user' ? 'text-sky-200' : 'text-slate-400'
                }`}>
                  {msg.timestamp}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5 items-center text-xs text-slate-400">
              <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                isDark ? 'bg-slate-800 border-slate-700 text-sky-400' : 'bg-slate-100 border-slate-200 text-sky-600'
              }`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sky-400">Analyzing model & consulting references...</span>
                <span className="text-[10px] text-slate-500">Evaluating arithmetic intensity, memory walls & tensor shapes</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className={`p-2.5 border-t shrink-0 flex flex-wrap gap-1.5 ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(qp)}
              className={`text-[10px] px-2 py-1 rounded-lg border transition-all text-left truncate max-w-[200px] ${
                isDark 
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-sky-500' 
                  : 'bg-white border-slate-200 text-slate-700 hover:text-sky-600 hover:border-sky-300 shadow-xs'
              }`}
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Chat Input & Reference Link Drawer */}
        <div className={`border-t shrink-0 ${isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white'}`}>
          {/* Active Attached Links List */}
          {attachedLinks.length > 0 && (
            <div className={`px-3 py-2 border-b flex flex-wrap items-center gap-1.5 ${
              isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-100/70 border-slate-200'
            }`}>
              <span className="text-[10px] font-semibold text-sky-400 flex items-center gap-1 mr-1">
                <Globe className="w-3 h-3" />
                Attached:
              </span>
              {attachedLinks.map((url, idx) => {
                let display = url;
                try {
                  const p = new URL(url);
                  display = `${p.hostname}${p.pathname.length > 15 ? p.pathname.slice(0, 15) + '...' : p.pathname}`;
                } catch {}
                return (
                  <div
                    key={idx}
                    className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg border text-[11px] font-mono ${
                      isDark 
                        ? 'bg-slate-800 border-sky-500/40 text-sky-200' 
                        : 'bg-white border-sky-300 text-sky-800 shadow-xs'
                    }`}
                  >
                    <span className="truncate max-w-[180px]">{display}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(url)}
                      className="p-0.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Remove webpage link"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Web Link Input Accordion */}
          {isLinkInputOpen && (
            <div className={`p-3 border-b space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-sky-400">
                  <Globe className="w-3.5 h-3.5" />
                  Attach Webpage Reference URL
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsLinkInputOpen(false);
                    setLinkError(null);
                  }}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    ref={linkInputRef}
                    type="url"
                    placeholder="https://arxiv.org/abs/... or docs link"
                    value={linkInputValue}
                    onChange={(e) => {
                      setLinkInputValue(e.target.value);
                      if (linkError) setLinkError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLink();
                      }
                    }}
                    className={`w-full rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      linkError 
                        ? 'border-rose-500 bg-rose-500/10' 
                        : isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <Globe className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => handleAddLink()}
                  disabled={!linkInputValue.trim()}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-medium transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Attach
                </button>
              </div>

              {linkError && (
                <p className="text-[10px] text-rose-400 font-mono mt-1">{linkError}</p>
              )}

              {/* Quick reference presets */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-500 block mb-1">Quick Suggestions:</span>
                <div className="flex flex-wrap gap-1">
                  {PRESET_WEB_REFERENCES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleAddLink(preset.url)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-sky-500 hover:text-white' 
                          : 'bg-white border-slate-200 text-slate-700 hover:border-sky-400 hover:text-sky-600'
                      }`}
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat Form */}
          <div className="p-3">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              {/* Web Link Toggle Button */}
              <button
                type="button"
                onClick={() => setIsLinkInputOpen(!isLinkInputOpen)}
                title="Attach webpage link for Copilot to refer to"
                className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
                  attachedLinks.length > 0 || isLinkInputOpen
                    ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-600/30'
                    : isDark 
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white' 
                    : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Globe className="w-4 h-4" />
                {attachedLinks.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-bold text-white flex items-center justify-center border border-slate-900">
                    {attachedLinks.length}
                  </span>
                )}
              </button>

              <input
                type="text"
                placeholder={attachedLinks.length > 0 ? "Ask about the attached webpage reference..." : "Ask Copilot to explain, edit, add, or optimize blocks..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className={`flex-1 rounded-xl px-3 py-2 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 transition-all shadow-xs cursor-pointer"
                title="Send prompt to Copilot"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
