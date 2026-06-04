'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Send, Plus, Menu, X, Settings, Sparkles, Moon, Sun,
  MessageCircle, Cpu, BookOpen, Link, Search, Copy, Check,
  ArrowUp, Paperclip, Mic, Image, ChevronDown
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  timestamp: number;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export default function KelseyAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<{ url: string; prompt: string }[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    groqKey: '',
    geminiKey: '',
    hfKey: '',
  });

  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.documentElement.classList.toggle('dark', darkMode); }, [darkMode]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, streamText]);

  // ─── Send ───────────────────────────────────────────

  const sendMessage = useCallback(async (text?: string) => {
    const content = text || input.trim();
    if (!content || streaming) return;

    const userMsg: Message = { id: `m_${Date.now()}`, role: 'user', content, timestamp: Date.now() };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamText('');

    let fullText = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })) }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.delta) { fullText += d.delta; setStreamText(fullText); }
              if (d.done) break;
            } catch {}
          }
        }
      }

      // Check for [IMAGE: ...] blocks and generate images
      const imageRegex = /\[IMAGE:\s*([^\]]+)\]/gi;
      let match;
      const imagePromises = [];
      while ((match = imageRegex.exec(fullText)) !== null) {
        imagePromises.push(generateImage(match[1]));
      }
      const imageResults = await Promise.all(imagePromises);

      const assistantMsg: Message = {
        id: `m_${Date.now()}_a`,
        role: 'assistant',
        content: fullText.replace(/\[IMAGE:[^\]]+\]/gi, '').trim(),
        images: imageResults.filter(Boolean) as string[],
        timestamp: Date.now(),
      };
      setMessages(p => [...p, assistantMsg]);
    } catch (e: any) {
      setMessages(p => [...p, {
        id: `m_${Date.now()}_e`, role: 'assistant',
        content: `⚠️ ${e.message}\n\nThe app uses free AI (Pollinations.ai) — no API keys required. Check your internet connection.`,
        timestamp: Date.now(),
      }]);
    } finally {
      setStreaming(false);
      setStreamText('');
    }
  }, [input, messages, streaming]);

  // ─── Image Gen ──────────────────────────────────────

  const generateImage = async (prompt: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, width: 1024, height: 1024 }),
      });
      const data = await res.json();
      if (data.url) {
        setGeneratedImages(p => [{ url: data.url, prompt }, ...p]);
        return data.url;
      }
    } catch {}
    return null;
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const newChat = () => {
    if (messages.length > 0) {
      setChats(p => [{ id: `c_${Date.now()}`, title: messages[0]?.content.slice(0, 50) || 'Chat', messages, createdAt: Date.now() }, ...p]);
    }
    setMessages([]);
    setSidebarOpen(false);
  };

  const isLanding = messages.length === 0;

  const quickActions = [
    { label: '⚡ Build an app', prompt: 'Build me a complete Next.js app with authentication, dashboard, and API. Include ALL files.' },
    { label: '🎭 Create a persona', prompt: 'Create a realistic social media persona for a lifestyle influencer. Give me her full name, age, location, detailed bio, personality, aesthetic, 10 post ideas with captions and hashtags, content calendar, and image descriptions for profile pictures and posts. Make her feel like a REAL person.' },
    { label: '🎨 Generate an image', prompt: 'Generate an image: a stunning portrait photo of a young woman with natural lighting, soft bokeh background, professional photography style, warm tones' },
    { label: '💰 Crypto tools', prompt: 'Show me the current top 10 crypto prices and design a tokenomics model for a new DeFi project' },
    { label: '🌐 Clone a website', prompt: 'How do I clone a website? Give me the approach and tools needed to replicate any website\'s design and functionality.' },
    { label: '🐧 Kali Linux', prompt: 'Show me the top 20 Kali Linux tools with real usage examples and commands for penetration testing.' },
    { label: '🚀 Deploy app', prompt: 'Help me deploy my Next.js application to Render. Give me the complete setup, render.yaml, and deployment steps.' },
    { label: '📱 Content calendar', prompt: 'Create a 30-day social media content calendar for Instagram and TikTok for a tech/lifestyle brand. Include dates, times, captions, hashtags, and visual descriptions.' },
  ];

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>
      {/* ─── SIDEBAR ─── */}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ width: 280, background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}>
        <div className="flex flex-col h-full">
          {/* Brand */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                <Sparkles size={18} color="#FFF" />
              </div>
              <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>Kelsey AI</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1"><X size={20} style={{ color: 'var(--muted)' }} /></button>
          </div>

          {/* New Chat */}
          <div className="px-3 mb-3">
            <button onClick={newChat} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: 'var(--accent)' }}>
              <Plus size={18} /> New Chat
            </button>
          </div>

          {/* Nav */}
          <div className="px-3 space-y-0.5">
            {[
              { icon: <MessageCircle size={18} />, label: 'Chats', count: chats.length },
              { icon: <Cpu size={18} />, label: '475 Agents' },
              { icon: <BookOpen size={18} />, label: 'Skills' },
              { icon: <Link size={18} />, label: 'Connectors' },
              { icon: <Settings size={18} />, label: 'Settings', action: () => setShowSettings(!showSettings) },
            ].map((item, i) => (
              <button key={i} onClick={item.action || undefined} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm" style={{ color: 'var(--text2)' }}>
                {item.icon}
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{item.count}</span>}
              </button>
            ))}
          </div>

          <div className="my-3 mx-4" style={{ borderBottom: '1px solid var(--border)' }} />

          {/* Recent */}
          <div className="flex-1 overflow-y-auto px-3">
            <p className="text-[11px] font-semibold tracking-wider px-3 py-2" style={{ color: 'var(--muted)' }}>RECENT</p>
            {chats.map(chat => (
              <button key={chat.id} onClick={() => { setMessages(chat.messages); setSidebarOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm truncate" style={{ color: 'var(--text2)' }}>
                {chat.title}
              </button>
            ))}
          </div>

          {/* Dark mode */}
          <div className="p-3">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl" style={{ background: 'var(--bg2)' }}>
              {darkMode ? <Sun size={18} style={{ color: 'var(--accent)' }} /> : <Moon size={18} style={{ color: 'var(--muted)' }} />}
            </button>
          </div>
        </div>
      </div>

      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ─── MAIN ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu size={22} style={{ color: 'var(--text)' }} /></button>
            <div className="flex items-center gap-2">
              <Sparkles size={20} style={{ color: 'var(--accent)' }} />
              <span className="font-bold" style={{ color: 'var(--text)' }}>Kelsey AI</span>
              {streaming && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#F0FFF4', color: '#22C55E' }}>Free AI • No keys needed</span>
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Settings size={20} style={{ color: 'var(--muted)' }} /></button>
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto" ref={chatRef}>
          {isLanding ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 px-6" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                <Sparkles size={40} color="#FFF" />
              </div>
              <h1 className="text-3xl font-bold text-center" style={{ color: 'var(--text)' }}>
                {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}. What shall we build?
              </h1>
              <p className="text-center max-w-md" style={{ color: 'var(--text2)' }}>
                One chat that understands everything — code, social media, crypto, images, deployment, security, anything.
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg mt-2">
                {quickActions.map((a, i) => (
                  <button key={i} onClick={() => sendMessage(a.prompt)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm hover:scale-105 transition-transform"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-[900px] mx-auto py-6 px-4 space-y-6">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const code = String(children).replace(/\n$/, '');
                            if (match) {
                              return (
                                <div className="relative group">
                                  <button onClick={() => { navigator.clipboard.writeText(code); setCopiedId(msg.id); setTimeout(() => setCopiedId(null), 2000); }}
                                    className="absolute top-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10" style={{ background: 'rgba(255,255,255,0.1)' }}>
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
                    {/* Images */}
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-4">
                        {msg.images.map((url: string, i: number) => (
                          <div key={i} className="relative group">
                            <img src={url} alt="" className="w-64 h-64 rounded-2xl object-cover" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                            <a href={url} target="_blank" download className="absolute bottom-2 right-2 p-2 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Image size={16} color="#FFF" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming */}
              {streaming && streamText && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mr-3 mt-1" style={{ background: 'var(--accent)' }}>
                    <Sparkles size={16} color="#FFF" />
                  </div>
                  <div className="max-w-[85%] prose prose-sm" style={{ color: 'var(--text)' }}>
                    <ReactMarkdown>{streamText}</ReactMarkdown>
                    <span className="streaming-cursor" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Image Gallery Bar */}
        {generatedImages.length > 0 && (
          <div className="px-4 py-2 flex gap-2 overflow-x-auto shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            {generatedImages.slice(0, 8).map((img, i) => (
              <a key={i} href={img.url} target="_blank" className="shrink-0">
                <img src={img.url} alt={img.prompt} className="w-12 h-12 rounded-lg object-cover" style={{ border: '2px solid var(--border)' }} />
              </a>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 pt-2 shrink-0">
          <div className="flex items-end gap-2 p-2 rounded-[30px]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
            <button className="p-2 rounded-xl shrink-0" style={{ background: 'var(--bg2)' }}><Plus size={20} style={{ color: 'var(--text2)' }} /></button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask anything — code, socials, crypto, images, deploy..."
              className="flex-1 resize-none bg-transparent outline-none text-[16px] leading-relaxed py-2 px-2 max-h-[140px] min-h-[40px]"
              style={{ color: 'var(--text)' }}
              rows={1}
            />
            <button className="p-2 shrink-0" style={{ color: 'var(--muted)' }}><Paperclip size={20} /></button>
            <button className="p-2 shrink-0" style={{ color: 'var(--muted)' }}><Mic size={20} /></button>
            <button onClick={() => sendMessage()} disabled={!input.trim() || streaming}
              className="p-2.5 rounded-full shrink-0 transition-colors"
              style={{ background: input.trim() ? 'var(--accent)' : 'var(--bg2)' }}>
              <ArrowUp size={18} color={input.trim() ? '#FFF' : 'var(--muted)'} />
            </button>
          </div>
          <p className="text-center text-[11px] mt-2" style={{ color: 'var(--muted)' }}>
            Powered by free AI • Pollinations.ai (no key) + Groq (optional free key)
          </p>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Settings</h2>
              <button onClick={() => setShowSettings(false)}><X size={20} style={{ color: 'var(--muted)' }} /></button>
            </div>
            <div className="rounded-xl p-4 space-y-1" style={{ background: '#F0FFF4' }}>
              <p className="font-bold text-green-700 text-sm">✅ Works Without API Keys</p>
              <p className="text-xs text-green-600">Uses Pollinations.ai by default — 100% free, no signup. Add keys below for faster responses.</p>
            </div>
            {[
              { label: 'Groq (Free — Recommended)', key: 'groqKey', placeholder: 'gsk_...', desc: 'console.groq.com' },
              { label: 'Google Gemini (Free)', key: 'geminiKey', placeholder: 'AIza...', desc: 'aistudio.google.com' },
            ].map(api => (
              <div key={api.key} className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{api.label}</label>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Get free key at {api.desc}</p>
                <input type="password" placeholder={api.placeholder} value={(settings as any)[api.key]}
                  onChange={e => setSettings(p => ({ ...p, [api.key]: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
            ))}
            <button onClick={() => { setShowSettings(false); setDarkMode(!darkMode); }}
              className="w-full py-3 rounded-xl font-semibold text-sm" style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>
              {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
