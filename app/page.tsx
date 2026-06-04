'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Send, Plus, Menu, X, Settings, Sparkles, Moon, Sun,
  MessageCircle, Cpu, Search, Copy, Check,
  ArrowUp, Paperclip, Mic, TrendingUp, Download, ExternalLink
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface Coin {
  id: string; name: string; symbol: string; image: string;
  price: number; change24h: number; marketCap: number; rank: number;
}

export default function KelseyAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [copiedId, setCopiedId] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [showCrypto, setShowCrypto] = useState(false);
  const [cryptoData, setCryptoData] = useState<Coin[]>([]);
  const [cryptoLoading, setCryptoLoading] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.documentElement.classList.toggle('dark', darkMode); }, [darkMode]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, streamText]);

  // Load crypto data
  const loadCrypto = useCallback(async () => {
    setCryptoLoading(true);
    try {
      const res = await fetch('/api/crypto');
      const data = await res.json();
      setCryptoData(data.markets || []);
      setShowCrypto(true);
    } catch {}
    setCryptoLoading(false);
  }, []);

  // ─── Send ───────────────────────────────────────────

  const sendMessage = useCallback(async (text?: string) => {
    const content = text || input.trim();
    if (!content || streaming) return;

    const userMsg: Message = { id: `m${Date.now()}`, role: 'user', content, timestamp: Date.now() };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamText('');

    let full = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })) }),
      });

      const reader = res.body?.getReader();
      const dec = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.delta) { full += d.delta; setStreamText(full); }
            } catch {}
          }
        }
      }

      setMessages(p => [...p, {
        id: `m${Date.now()}a`, role: 'assistant',
        content: full || 'No response. Please try again.',
        timestamp: Date.now(),
      }]);
    } catch (e: any) {
      setMessages(p => [...p, {
        id: `m${Date.now()}e`, role: 'assistant',
        content: `⚠️ ${e.message}\n\nWorks with free AI — no keys needed. Check connection and retry.`,
        timestamp: Date.now(),
      }]);
    } finally {
      setStreaming(false);
      setStreamText('');
    }
  }, [input, messages, streaming]);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const newChat = () => {
    if (messages.length > 0) {
      setChats(p => [{ id: `c${Date.now()}`, title: messages[0]?.content.slice(0, 60) || 'Chat', messages, createdAt: Date.now() }, ...p]);
    }
    setMessages([]);
    setSidebarOpen(false);
  };

  const isLanding = messages.length === 0;

  const actions = [
    { emoji: '🎭', label: 'Create a persona', prompt: 'Create a complete realistic social media persona for a lifestyle influencer girl. Give me: full name, age, city, nationality, detailed bio (200 words), personality, aesthetic, 15 post ideas with full captions and 20+ hashtags each, 7-day content calendar, and generate her profile picture and 3 content images using the image format.' },
    { emoji: '🎨', label: 'Generate image', prompt: 'Generate a photorealistic portrait of a young woman in golden hour lighting, natural beauty, DSLR quality, soft bokeh background, warm tones' },
    { emoji: '💻', label: 'Build an app', prompt: 'Build me a complete Next.js 15 app with authentication (JWT), dashboard with charts, CRUD API routes, PostgreSQL schema, and deployment config. Include ALL files with complete code.' },
    { emoji: '💰', label: 'Crypto market', prompt: 'Show me the current top cryptocurrencies and create a complete tokenomics model for a new DeFi project with token distribution, vesting, staking rewards, and ROI projections.' },
    { emoji: '📱', label: 'Social media', prompt: 'Create a 30-day Instagram and TikTok content calendar for a tech brand. For each day: date, time, content type, full caption, 15+ hashtags, and visual description. Make it realistic and engaging.' },
    { emoji: '⛓️', label: 'Smart contract', prompt: 'Write a complete ERC-20 Solidity smart contract with minting, burning, staking, governance voting, anti-whale limits, and automated liquidity. Include deployment script and tests.' },
    { emoji: '🌐', label: 'Clone website', prompt: 'How do I clone any website? Give me the complete approach, tools needed (puppeteer, etc.), and a working script that extracts structure, styles, and assets from any URL.' },
    { emoji: '🚀', label: 'Deploy to Render', prompt: 'Give me the complete setup to deploy a Next.js app to Render: render.yaml, Dockerfile, build commands, environment variables, and step-by-step instructions.' },
    { emoji: '🐧', label: 'Kali Linux tools', prompt: 'List the top 20 Kali Linux penetration testing tools with real commands and usage examples. Include nmap, metasploit, burp suite, sqlmap, hydra, aircrack-ng, and more.' },
    { emoji: '📝', label: 'Write content', prompt: 'Write a compelling 2000-word blog post about the future of AI in 2025. Include headers, bullet points, statistics, and a strong call to action.' },
    { emoji: '🎯', label: 'Marketing plan', prompt: 'Create a complete digital marketing strategy for a SaaS startup launching in 2025. Include: target audience, channels, budget allocation, content strategy, SEO plan, paid ads strategy, and KPIs.' },
    { emoji: '🔒', label: 'Security audit', prompt: 'Perform a security audit checklist for a web application. Include: authentication, authorization, input validation, XSS, CSRF, SQL injection, rate limiting, headers, and remediation steps.' },
  ];

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>
      {/* SIDEBAR */}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ width: 280, background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}><Sparkles size={18} color="#FFF" /></div>
              <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>Kelsey AI</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X size={20} style={{ color: 'var(--muted)' }} /></button>
          </div>
          <div className="px-3 mb-3">
            <button onClick={newChat} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: 'var(--accent)' }}><Plus size={18} /> New Chat</button>
          </div>
          <div className="px-3 mb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <Search size={14} style={{ color: 'var(--muted)' }} />
              <input placeholder="Search..." className="bg-transparent outline-none flex-1 text-sm" style={{ color: 'var(--text)' }} />
            </div>
          </div>
          <div className="px-3 space-y-0.5">
            <button onClick={() => { loadCrypto(); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm" style={{ color: 'var(--text2)' }}>
              <TrendingUp size={18} /> Crypto Market
            </button>
            <button onClick={() => { setShowSettings(true); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm" style={{ color: 'var(--text2)' }}>
              <Settings size={18} /> Settings
            </button>
          </div>
          <div className="my-3 mx-4" style={{ borderBottom: '1px solid var(--border)' }} />
          <div className="flex-1 overflow-y-auto px-3">
            <p className="text-[11px] font-semibold tracking-wider px-3 py-2" style={{ color: 'var(--muted)' }}>RECENT</p>
            {chats.map(c => (
              <button key={c.id} onClick={() => { setMessages(c.messages); setSidebarOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm truncate" style={{ color: 'var(--text2)' }}>{c.title}</button>
            ))}
          </div>
          <div className="p-3 flex items-center gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl" style={{ background: 'var(--bg2)' }}>
              {darkMode ? <Sun size={18} style={{ color: 'var(--accent)' }} /> : <Moon size={18} style={{ color: 'var(--muted)' }} />}
            </button>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Free AI • No keys needed</span>
          </div>
        </div>
      </div>
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu size={22} style={{ color: 'var(--text)' }} /></button>
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
            <span className="font-bold" style={{ color: 'var(--text)' }}>Kelsey AI</span>
            {streaming && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadCrypto} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>
              <TrendingUp size={14} /> Market
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg lg:hidden"><Settings size={18} style={{ color: 'var(--muted)' }} /></button>
          </div>
        </div>

        {/* Crypto Bar */}
        {showCrypto && cryptoData.length > 0 && (
          <div className="flex gap-4 px-4 py-2 overflow-x-auto shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
            {cryptoData.slice(0, 8).map(c => (
              <div key={c.id} className="flex items-center gap-2 shrink-0">
                <img src={c.image} alt="" className="w-5 h-5 rounded-full" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{c.symbol}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>${c.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span className={`text-xs font-mono ${c.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {c.change24h?.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Chat */}
        <div className="flex-1 overflow-y-auto" ref={chatRef}>
          {isLanding ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 px-6 animate-in">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                <Sparkles size={40} color="#FFF" />
              </div>
              <h1 className="text-3xl font-bold text-center" style={{ color: 'var(--text)' }}>
                {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}. What shall we create?
              </h1>
              <p style={{ color: 'var(--text2)' }} className="text-center max-w-md">
                One chat. Understands everything. Creates anything. Free AI, no API keys needed.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-w-2xl">
                {actions.map((a, i) => (
                  <button key={i} onClick={() => sendMessage(a.prompt)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left hover:scale-[1.02] transition-transform"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                    <span>{a.emoji}</span>
                    <span className="truncate">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-[900px] mx-auto py-6 px-4 space-y-6">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mr-3 mt-1" style={{ background: 'var(--accent)' }}>
                      <Sparkles size={16} color="#FFF" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'rounded-[20px] rounded-br-sm' : ''}`}
                    style={{ background: msg.role === 'user' ? 'var(--user-bubble)' : 'transparent', padding: msg.role === 'user' ? '14px 20px' : '0' }}>
                    {msg.role === 'user' ? (
                      <p className="text-[16px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none" style={{ color: 'var(--text)' }}>
                        <ReactMarkdown components={{
                          // Render images inline
                          img({ src, alt }) {
                            if (!src || typeof src !== 'string') return null;
                            return (
                              <span className="block my-3">
                                <img src={src} alt={alt || ''} className="rounded-2xl max-w-full" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} loading="lazy" />
                                <a href={src} target="_blank" download className="inline-flex items-center gap-1 mt-2 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                                  <Download size={12} /> Save Image
                                </a>
                              </span>
                            );
                          },
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const code = String(children).replace(/\n$/, '');
                            if (match) {
                              return (
                                <div className="relative group my-3">
                                  <button onClick={() => copyCode(code, msg.id)}
                                    className="absolute top-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    style={{ background: 'rgba(255,255,255,0.1)' }}>
                                    {copiedId === msg.id ? <Check size={14} color="#22C55E" /> : <Copy size={14} color="#888" />}
                                  </button>
                                  <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">{code}</SyntaxHighlighter>
                                </div>
                              );
                            }
                            return <code className={className} {...props}>{children}</code>;
                          },
                        }}>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming */}
              {streaming && streamText && (
                <div className="flex justify-start animate-in">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mr-3 mt-1" style={{ background: 'var(--accent)' }}>
                    <Sparkles size={16} color="#FFF" />
                  </div>
                  <div className="max-w-[85%] prose prose-sm" style={{ color: 'var(--text)' }}>
                    <ReactMarkdown components={{
                      img({ src, alt }) {
                        if (!src || typeof src !== 'string') return null;
                        return <img src={src} alt={alt || ''} className="rounded-2xl max-w-full my-3" loading="lazy" />;
                      },
                    }}>{streamText}</ReactMarkdown>
                    <span className="streaming-cursor" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 shrink-0">
          <div className="flex items-end gap-2 p-2 rounded-[30px]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
            <button className="p-2 rounded-xl shrink-0" style={{ background: 'var(--bg2)' }}><Plus size={20} style={{ color: 'var(--text2)' }} /></button>
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask anything — personas, images, code, crypto, socials, deploy..."
              className="flex-1 resize-none bg-transparent outline-none text-[16px] leading-relaxed py-2 px-2 max-h-[140px] min-h-[40px]"
              style={{ color: 'var(--text)' }} rows={1}
            />
            <button className="p-2 shrink-0" style={{ color: 'var(--muted)' }}><Paperclip size={20} /></button>
            <button className="p-2 shrink-0" style={{ color: 'var(--muted)' }}><Mic size={20} /></button>
            <button onClick={() => sendMessage()} disabled={!input.trim() || streaming}
              className="p-2.5 rounded-full shrink-0 transition-colors"
              style={{ background: input.trim() ? 'var(--accent)' : 'var(--bg2)' }}>
              <ArrowUp size={18} color={input.trim() ? '#FFF' : 'var(--muted)'} />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4 mx-4" style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>⚙️ Settings</h2>
              <button onClick={() => setShowSettings(false)}><X size={20} style={{ color: 'var(--muted)' }} /></button>
            </div>
            <div className="rounded-xl p-4 space-y-1" style={{ background: '#F0FFF4' }}>
              <p className="font-bold text-green-700 text-sm">✅ Works Without Any API Keys</p>
              <p className="text-xs text-green-600">Uses Pollinations.ai by default — 100% free, no signup. Add keys for faster/better responses.</p>
            </div>
            {[
              { label: 'Groq API Key (Free — Recommended)', placeholder: 'gsk_...', hint: 'Get free at console.groq.com', env: 'GROQ_API_KEY' },
              { label: 'Google Gemini API Key (Free)', placeholder: 'AIza...', hint: 'Get free at aistudio.google.com', env: 'GEMINI_API_KEY' },
            ].map(api => (
              <div key={api.env} className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{api.label}</label>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{api.hint}</p>
                <input type="password" placeholder={api.placeholder}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
            ))}
            <button onClick={() => { setDarkMode(!darkMode); }}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>
              {darkMode ? <><Sun size={16} /> Switch to Light</> : <><Moon size={16} /> Switch to Dark</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
