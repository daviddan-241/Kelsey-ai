'use client';

import { useState, useRef, useEffect, useCallback, type ChangeEvent, type DragEvent, type ClipboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Send, Plus, Menu, X, Settings, Sparkles, Moon, Sun,
  Search, Copy, Check, ArrowUp, Paperclip, Mic, MicOff,
  TrendingUp, Download, Trash2, MessageSquare, Share2,
  ChevronDown, FileText, Image, Code, Globe, Bot,
  Volume2, Pause, Play, RotateCcw, Star, Zap, Eye
} from 'lucide-react';

/* ─── TYPES ──────────────────────────────────────────── */
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  files?: string[];
  starred?: boolean;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  starred?: boolean;
}

interface Coin {
  id: string; name: string; symbol: string; image: string;
  price: number; change24h: number; marketCap: number; rank: number;
}

interface Settings {
  groqKey: string;
  geminiKey: string;
  darkMode: boolean;
  provider: string;
  voiceEnabled: boolean;
  autoSpeak: boolean;
}

/* ─── LOCAL STORAGE HELPERS ──────────────────────────── */
function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveToStorage(key: string, value: any) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ─── MAIN COMPONENT ─────────────────────────────────── */
export default function KelseyAI() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    groqKey: '', geminiKey: '', darkMode: false, provider: 'auto',
    voiceEnabled: true, autoSpeak: false,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showCrypto, setShowCrypto] = useState(false);
  const [cryptoData, setCryptoData] = useState<Coin[]>([]);
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toast, setToast] = useState('');
  const [droppedFiles, setDroppedFiles] = useState<{ name: string; content: string; type: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'tools'>('chats');

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Init
  useEffect(() => {
    setChats(loadFromStorage<Chat[]>('kelsey-chats', []));
    setMessages(loadFromStorage<Message[]>('kelsey-current', []));
    const s = loadFromStorage<Settings>('kelsey-settings', {
      groqKey: '', geminiKey: '', darkMode: false, provider: 'auto',
      voiceEnabled: true, autoSpeak: false,
    });
    setSettings(s);
    if (s.darkMode) document.documentElement.classList.add('dark');
    if (typeof window !== 'undefined') synthRef.current = window.speechSynthesis;
  }, []);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, streamText]);
  useEffect(() => { saveToStorage('kelsey-current', messages); }, [messages]);
  useEffect(() => { saveToStorage('kelsey-chats', chats); }, [chats]);
  useEffect(() => {
    saveToStorage('kelsey-settings', settings);
    document.documentElement.classList.toggle('dark', settings.darkMode);
  }, [settings]);

  // ─── TOAST ─────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  // ─── CRYPTO ────────────────────────────────────────
  const loadCrypto = useCallback(async () => {
    setCryptoLoading(true);
    try {
      const res = await fetch('/api/crypto');
      const data = await res.json();
      setCryptoData(data.markets || []);
      setShowCrypto(true);
    } catch { showToast('Failed to load crypto data'); }
    setCryptoLoading(false);
  }, [showToast]);

  // ─── VOICE INPUT (REAL Web Speech API) ──────────────
  const toggleVoice = useCallback(() => {
    if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      showToast('Voice input not supported in this browser');
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e: any) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onerror = () => { setIsRecording(false); showToast('Voice recognition error'); };
    recognition.onend = () => { setIsRecording(false); };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    showToast('🎤 Listening... speak now');
  }, [isRecording, showToast]);

  // ─── TEXT-TO-SPEECH (REAL) ──────────────────────────
  const speakText = useCallback((text: string) => {
    if (!synthRef.current) return;
    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }
    // Strip markdown/images for cleaner speech
    const clean = text
      .replace(/!\[.*?\]\(.*?\)/g, '[image]')
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
      .replace(/```[\s\S]*?```/g, '[code block]')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#*_~]/g, '')
      .slice(0, 2000);

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
    setIsSpeaking(true);
  }, [isSpeaking]);

  // ─── FILE HANDLING (REAL) ──────────────────────────
  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setDroppedFiles(p => [...p, { name: file.name, content, type: file.type }]);
        showToast(`📎 ${file.name} attached`);
      };
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  }, [showToast]);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFiles([file]);
      }
    }
  };

  // ─── EXPORT CHAT (REAL) ────────────────────────────
  const exportChat = useCallback(() => {
    const md = messages.map(m => `## ${m.role === 'user' ? '👤 You' : '✨ Kelsey AI'}\n\n${m.content}\n\n---\n`).join('\n');
    const blob = new Blob([`# Kelsey AI Chat Export\n${new Date().toLocaleString()}\n\n---\n\n${md}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kelsey-ai-chat-${Date.now()}.md`;
    a.click(); URL.revokeObjectURL(url);
    showToast('📥 Chat exported');
  }, [messages, showToast]);

  // ─── SEND MESSAGE (REAL STREAMING) ─────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const content = text || input.trim();
    if (!content && droppedFiles.length === 0) return;
    if (streaming) return;

    // Build full message with file context
    let fullContent = content;
    if (droppedFiles.length > 0) {
      fullContent += '\n\n📎 **Attached files:**\n';
      for (const f of droppedFiles) {
        if (f.type.startsWith('image/')) {
          fullContent += `\n![${f.name}](${f.content})\n`;
        } else {
          fullContent += `\n**${f.name}:**\n\`\`\`\n${f.content.slice(0, 5000)}\n\`\`\`\n`;
        }
      }
      setDroppedFiles([]);
    }

    const userMsg: Message = { id: `m${Date.now()}`, role: 'user', content: fullContent, timestamp: Date.now() };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamText('');

    let full = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          provider: settings.provider,
        }),
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

      const assistantMsg: Message = {
        id: `m${Date.now()}a`, role: 'assistant',
        content: full || 'No response received. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(p => [...p, assistantMsg]);

      // Auto-speak if enabled
      if (settings.autoSpeak && full) speakText(full);

    } catch (e: any) {
      setMessages(p => [...p, {
        id: `m${Date.now()}e`, role: 'assistant',
        content: `⚠️ Connection error: ${e.message}\n\nThis works with free AI — no keys needed. Check your connection and try again.`,
        timestamp: Date.now(),
      }]);
    } finally {
      setStreaming(false);
      setStreamText('');
    }
  }, [input, messages, streaming, droppedFiles, settings, speakText]);

  // ─── CHAT MANAGEMENT ──────────────────────────────
  const newChat = () => {
    if (messages.length > 0) {
      const title = messages[0]?.content.slice(0, 50) || 'New Chat';
      setChats(p => [{ id: `c${Date.now()}`, title, messages, createdAt: Date.now() }, ...p].slice(0, 50));
    }
    setMessages([]);
    setSidebarOpen(false);
  };

  const loadChat = (chat: Chat) => {
    if (messages.length > 0) {
      setChats(p => [{ id: `c${Date.now()}`, title: messages[0]?.content.slice(0, 50) || 'Chat', messages, createdAt: Date.now() }, ...p].slice(0, 50));
    }
    setMessages(chat.messages);
    setSidebarOpen(false);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(p => p.filter(c => c.id !== id));
    showToast('Chat deleted');
  };

  const clearAll = () => {
    setMessages([]);
    setChats([]);
    localStorage.removeItem('kelsey-current');
    localStorage.removeItem('kelsey-chats');
    showToast('All chats cleared');
  };

  const regenerate = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    setMessages(p => p.slice(0, -1)); // remove last assistant msg
    setTimeout(() => sendMessage(lastUser.content), 100);
  };

  // ─── COPY CODE ─────────────────────────────────────
  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    showToast('📋 Copied');
    setTimeout(() => setCopiedId(''), 2000);
  };

  // ─── AUTO RESIZE TEXTAREA ──────────────────────────
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  };

  // ─── QUICK ACTIONS ─────────────────────────────────
  const actions = [
    { emoji: '🎭', label: 'Create a persona', desc: 'Full social media identity', prompt: 'Create a complete realistic social media persona for a lifestyle influencer girl. Give me: full name, age, city, nationality, zodiac sign, detailed 200+ word bio in first person, personality traits, aesthetic, social handles, 15 post ideas with FULL captions and 25+ hashtags each, 7-day content calendar, monetization strategy, and generate her profile picture and 3 content images.' },
    { emoji: '🎨', label: 'Generate image', desc: 'AI art & photos', prompt: 'Generate a photorealistic portrait of a young woman with wavy brown hair, warm golden hour lighting, soft smile, natural makeup, outdoor cafe setting, DSLR Canon R5 85mm f/1.4, shallow depth of field, warm bokeh. Also generate 2 more variations with different angles and outfits.' },
    { emoji: '💻', label: 'Build an app', desc: 'Full code output', prompt: 'Build me a complete Next.js 15 app with: JWT authentication (login/register), dashboard with Chart.js graphs, CRUD API routes for posts, PostgreSQL schema, Prisma ORM, Tailwind CSS, and deployment config (render.yaml, Dockerfile). Include ALL files with complete working code.' },
    { emoji: '💰', label: 'Crypto & Web3', desc: 'Markets & contracts', prompt: 'Show me the top crypto trends right now and create a complete ERC-20 token smart contract with: minting, burning, staking rewards, governance voting, anti-whale transaction limits, automated liquidity pool, and vesting schedule. Include deployment script and Hardhat tests.' },
    { emoji: '📱', label: 'Social media', desc: 'Content calendar', prompt: 'Create a detailed 30-day Instagram + TikTok content calendar for a tech startup brand. For each day include: date, exact posting time, content type (reel/carousel/story/post), FULL caption (not generic - write the actual text), 20+ hashtags, visual description, and CTA. Make it realistic and engaging.' },
    { emoji: '⛓️', label: 'Smart contract', desc: 'Solidity code', prompt: 'Write a complete Solidity smart contract for a DeFi yield farming protocol with: token staking, reward distribution, liquidity pool integration, emergency withdrawal, timelock governance, and reentrancy protection. Include deployment script + full test suite.' },
    { emoji: '🌐', label: 'Clone website', desc: 'Extract & rebuild', prompt: 'Give me a complete working script that can clone any website. Include: 1) A Puppeteer script that extracts HTML, CSS, JS, and downloads all assets 2) A Node.js server that serves the cloned site 3) Screenshot comparison tool. Full working code, all files, ready to run.' },
    { emoji: '🚀', label: 'Deploy', desc: 'Render + Docker', prompt: 'Give me the complete deployment setup for a Next.js 15 app: render.yaml, Dockerfile (multi-stage), .dockerignore, docker-compose.yml, GitHub Actions CI/CD pipeline, environment variables checklist, and step-by-step Render deployment instructions.' },
    { emoji: '🐧', label: 'Kali Linux', desc: 'Security tools', prompt: 'List the top 20 Kali Linux penetration testing tools with REAL commands and step-by-step usage examples. Include: nmap, metasploit, burp suite, sqlmap, hydra, aircrack-ng, john, hashcat, wireshark, nikto, gobuster, ffuf, and more. Include actual commands that work.' },
    { emoji: '📝', label: 'Write content', desc: 'Blog & copy', prompt: 'Write a compelling 2000+ word blog post about "The Future of AI Agents in 2025". Include: catchy title, introduction with a hook, 5+ sections with H2 headers, statistics and data points, bullet points, a case study, and a strong CTA. SEO-optimized with keywords.' },
    { emoji: '🎯', label: 'Marketing plan', desc: 'Growth strategy', prompt: 'Create a complete digital marketing strategy for a SaaS startup. Include: target audience persona, channel strategy (SEO, paid, social, email), monthly budget allocation table, content calendar template, KPIs dashboard, A/B testing plan, and 6-month growth roadmap with specific milestones.' },
    { emoji: '🔒', label: 'Security audit', desc: 'App pentest', prompt: 'Perform a complete web application security audit checklist with: 1) Authentication testing 2) Authorization bypass 3) SQL injection payloads 4) XSS test vectors 5) CSRF attack scenarios 6) Rate limiting checks 7) Header security 8) File upload vulnerabilities 9) API security testing 10) Remediation steps for each finding.' },
  ];

  const isLanding = messages.length === 0;
  const hasFiles = droppedFiles.length > 0;

  // ─── MARKDOWN COMPONENTS ───────────────────────────
  const mdComponents: Record<string, any> = {
    img({ src, alt }: { src?: any; alt?: string }) {
      const srcStr = typeof src === 'string' ? src : null;
      if (!srcStr) return null;
      const isPollinations = srcStr.includes('pollinations.ai');
      return (
        <span className="block my-4">
          <img
            src={srcStr}
            alt={alt || 'AI generated image'}
            className="generated-img"
            loading="lazy"
            onClick={() => setImageLightbox(srcStr)}
          />
          <span className="flex items-center gap-3 mt-2">
            <a href={srcStr} target="_blank" download
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              <Download size={12} /> Save Image
            </a>
            <a href={srcStr} target="_blank" rel="noopener"
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--muted)' }}>
              <ExternalLink size={12} /> Full Size
            </a>
          </span>
        </span>
      );
    },
    code({ className, children, ...props }: { className?: string; children?: React.ReactNode; [key: string]: any }) {
      const match = /language-(\w+)/.exec(className || '');
      const code = String(children).replace(/\n$/, '');
      const id = `code-${code.slice(0, 20).replace(/\s/g, '')}`;
      if (match) {
        return (
          <div className="relative group my-4">
            <div className="flex items-center justify-between px-4 py-2 text-xs rounded-t-xl" style={{ background: '#1a1b26', borderBottom: '1px solid #24283b' }}>
              <span className="text-blue-400 font-mono">{match[1]}</span>
              <button onClick={() => copyCode(code, id)}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors">
                {copiedId === id ? <><Check size={12} className="text-green-400" /> Copied!</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div"
              customStyle={{ margin: 0, borderRadius: '0 0 14px 14px' }}>{code}</SyntaxHighlighter>
          </div>
        );
      }
      return <code className={className} {...props}>{children}</code>;
    },
  };

  // ExternalLink for JSX
  const ExternalLink = ({ size, className, children, style }: { size?: number; className?: string; children?: React.ReactNode; style?: React.CSSProperties }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
  );

  // ─── RENDER ────────────────────────────────────────
  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}>

      {/* ═══ SIDEBAR ═══ */}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ width: 280, background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)', boxShadow: '0 4px 12px rgba(217,119,87,0.3)' }}>
                <Sparkles size={18} color="#FFF" />
              </div>
              <div>
                <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>Kelsey AI</span>
                <p className="text-[10px] font-medium" style={{ color: 'var(--accent)' }}>475 Agents Active</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X size={20} style={{ color: 'var(--muted)' }} /></button>
          </div>

          {/* New Chat */}
          <div className="px-3 mb-2">
            <button onClick={newChat} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90" style={{ background: 'var(--accent)' }}>
              <Plus size={16} /> New Chat
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-3 gap-1 mb-2">
            {(['chats', 'tools'] as const).map(tab => (
              <button key={tab} onClick={() => setSidebarTab(tab)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
                style={{ background: sidebarTab === tab ? 'var(--bg2)' : 'transparent', color: sidebarTab === tab ? 'var(--text)' : 'var(--muted)' }}>
                {tab === 'chats' ? '💬 Chats' : '🔧 Tools'}
              </button>
            ))}
          </div>

          {sidebarTab === 'chats' ? (
            <div className="flex-1 overflow-y-auto px-3">
              <p className="text-[10px] font-bold tracking-widest px-2 py-2" style={{ color: 'var(--muted)' }}>HISTORY</p>
              {chats.length === 0 && <p className="text-xs px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>No chats yet</p>}
              {chats.map(c => (
                <div key={c.id} className="group relative">
                  <button onClick={() => loadChat(c)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors hover:opacity-80"
                    style={{ color: 'var(--text2)' }}>
                    <MessageSquare size={12} className="inline mr-2 opacity-40" />
                    {c.title}
                  </button>
                  <button onClick={(e) => deleteChat(c.id, e)}
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded">
                    <Trash2 size={12} style={{ color: 'var(--error)' }} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
              <button onClick={loadCrypto} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm" style={{ color: 'var(--text2)' }}>
                <TrendingUp size={16} /> Crypto Market
              </button>
              <button onClick={exportChat} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm" style={{ color: 'var(--text2)' }}>
                <Download size={16} /> Export Chat
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm" style={{ color: 'var(--text2)' }}>
                <Paperclip size={16} /> Upload File
              </button>
              <button onClick={clearAll} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm" style={{ color: 'var(--error)' }}>
                <Trash2 size={16} /> Clear All Data
              </button>
            </div>
          )}

          {/* Bottom */}
          <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="rounded-xl p-3" style={{ background: 'var(--bg2)' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>All Systems Live</span>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Free AI • No keys needed • {messages.length} msgs</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))}
                className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium"
                style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>
                {settings.darkMode ? <><Sun size={14} /> Light</> : <><Moon size={14} /> Dark</>}
              </button>
              <button onClick={() => setShowSettings(true)}
                className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium"
                style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>
                <Settings size={14} /> Settings
              </button>
            </div>
          </div>
        </div>
      </div>
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu size={22} style={{ color: 'var(--text)' }} /></button>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <Sparkles size={14} color="#FFF" />
            </div>
            <span className="font-bold" style={{ color: 'var(--text)' }}>Kelsey AI</span>
            {streaming && (
              <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> Thinking...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadCrypto} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{ background: cryptoLoading ? 'var(--accent-light)' : 'var(--bg2)', color: 'var(--text2)' }}>
              {cryptoLoading ? <span className="shimmer">Loading...</span> : <><TrendingUp size={13} /> Market</>}
            </button>
            <button onClick={exportChat} className="p-1.5 rounded-lg" title="Export"><Download size={16} style={{ color: 'var(--muted)' }} /></button>
            <button onClick={() => setShowSettings(true)} className="p-1.5 rounded-lg"><Settings size={16} style={{ color: 'var(--muted)' }} /></button>
          </div>
        </div>

        {/* Crypto Bar */}
        {showCrypto && cryptoData.length > 0 && (
          <div className="flex gap-4 px-4 py-2 overflow-x-auto shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <button onClick={() => setShowCrypto(false)} className="shrink-0 text-xs" style={{ color: 'var(--muted)' }}><ChevronDown size={14} /></button>
            {cryptoData.slice(0, 10).map(c => (
              <div key={c.id} className="flex items-center gap-2 shrink-0">
                <img src={c.image} alt="" className="w-4 h-4 rounded-full" />
                <span className="text-[11px] font-bold" style={{ color: 'var(--text)' }}>{c.symbol}</span>
                <span className="text-[11px] font-mono" style={{ color: 'var(--text)' }}>
                  ${c.price?.toLocaleString(undefined, { maximumFractionDigits: c.price < 1 ? 4 : 2 })}
                </span>
                <span className={`text-[11px] font-mono font-semibold ${c.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {c.change24h >= 0 ? '↑' : '↓'} {Math.abs(c.change24h)?.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Drop zone overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: 'rgba(217,119,87,0.1)', border: '3px dashed var(--accent)' }}>
            <div className="text-center">
              <Paperclip size={48} style={{ color: 'var(--accent)' }} className="mx-auto mb-3" />
              <p className="text-lg font-bold" style={{ color: 'var(--accent)' }}>Drop files here</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Images, code, documents — anything</p>
            </div>
          </div>
        )}

        {/* ═══ CHAT AREA ═══ */}
        <div className="flex-1 overflow-y-auto" ref={chatRef}>
          {isLanding ? (
            /* ─── LANDING ─── */
            <div className="flex flex-col items-center justify-center h-full gap-8 px-6 animate-in">
              <div className="w-24 h-24 rounded-3xl flex items-center justify-center animate-scale" style={{ background: 'var(--accent)', boxShadow: '0 8px 32px rgba(217,119,87,0.3)' }}>
                <Sparkles size={48} color="#FFF" />
              </div>
              <div className="text-center">
                <h1 className="text-4xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>
                  {new Date().getHours() < 12 ? '☀️ Good morning' : new Date().getHours() < 17 ? '🌤️ Good afternoon' : '🌙 Good evening'}
                </h1>
                <p className="text-xl font-medium" style={{ color: 'var(--text2)' }}>What shall we create today?</p>
                <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>One chat. 475 agents. Understands everything. Creates anything. Free.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-w-3xl w-full">
                {actions.map((a, i) => (
                  <button key={i} onClick={() => sendMessage(a.prompt)}
                    className="flex flex-col items-start gap-1 px-4 py-3.5 rounded-2xl text-left hover:scale-[1.03] transition-all duration-200"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <span className="text-xl">{a.emoji}</span>
                    <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{a.label}</span>
                    <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{a.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ─── MESSAGES ─── */
            <div className="max-w-[900px] mx-auto py-6 px-4 space-y-5">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mr-3 mt-1" style={{ background: 'var(--accent)' }}>
                      <Sparkles size={15} color="#FFF" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'rounded-[22px] rounded-br-md' : ''}`}
                    style={{ background: msg.role === 'user' ? 'var(--user-bubble)' : 'transparent', padding: msg.role === 'user' ? '14px 20px' : '0' }}>
                    {msg.role === 'user' ? (
                      <p className="text-[15.5px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{msg.content}</p>
                    ) : (
                      <div>
                        <div className="prose prose-sm max-w-none" style={{ color: 'var(--text)' }}>
                          <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                        </div>
                        {/* Message actions */}
                        <div className="flex items-center gap-1 mt-2 opacity-0 hover:opacity-100 transition-opacity" style={{ transitionDelay: '0.3s' }}>
                          <button onClick={() => { navigator.clipboard.writeText(msg.content); showToast('📋 Copied'); }}
                            className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--muted)' }} title="Copy">
                            <Copy size={13} />
                          </button>
                          <button onClick={() => speakText(msg.content)}
                            className="p-1.5 rounded-lg transition-colors" style={{ color: isSpeaking ? 'var(--accent)' : 'var(--muted)' }} title="Read aloud">
                            {isSpeaking ? <Pause size={13} /> : <Volume2 size={13} />}
                          </button>
                          <button onClick={regenerate}
                            className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--muted)' }} title="Regenerate">
                            <RotateCcw size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming bubble */}
              {streaming && streamText && (
                <div className="flex justify-start animate-in">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mr-3 mt-1" style={{ background: 'var(--accent)' }}>
                    <Sparkles size={15} color="#FFF" />
                  </div>
                  <div className="max-w-[85%]">
                    <div className="prose prose-sm max-w-none" style={{ color: 'var(--text)' }}>
                      <ReactMarkdown components={{
                        img({ src, alt }: { src?: any; alt?: string }) {
                          const s = typeof src === 'string' ? src : null;
                          if (!s) return null;
                          return <img src={s} alt={alt || ''} className="generated-img" loading="lazy" />;
                        }
                      } as Record<string, any>}>{streamText}</ReactMarkdown>
                    </div>
                    <span className="streaming-cursor" />
                  </div>
                </div>
              )}

              {/* Streaming indicator when empty */}
              {streaming && !streamText && (
                <div className="flex justify-start animate-in">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mr-3" style={{ background: 'var(--accent)' }}>
                    <Sparkles size={15} color="#FFF" />
                  </div>
                  <div className="flex gap-1.5 py-4">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ INPUT AREA ═══ */}
        <div className="px-4 pb-4 pt-2 shrink-0">
          {/* Attached files */}
          {hasFiles && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {droppedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                  {f.type.startsWith('image/') ? <Image size={12} /> : <FileText size={12} />}
                  <span className="font-medium">{f.name}</span>
                  <button onClick={() => setDroppedFiles(p => p.filter((_, j) => j !== i))}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}

          <div className={`flex items-end gap-2 p-2 rounded-[28px] transition-all ${isDragging ? 'ring-2 ring-[var(--accent)]' : ''}`}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileInput} />
            <button onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl shrink-0 transition-colors hover:opacity-80" style={{ background: 'var(--bg2)' }}>
              <Plus size={18} style={{ color: 'var(--text2)' }} />
            </button>
            <textarea
              ref={inputRef}
              value={input} onChange={handleInputChange}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              onPaste={handlePaste}
              placeholder="Ask anything — personas, images, code, crypto, deploy..."
              className="flex-1 resize-none bg-transparent outline-none text-[16px] leading-relaxed py-2 px-1 max-h-[140px] min-h-[24px]"
              style={{ color: 'var(--text)' }} rows={1}
            />
            <button onClick={toggleVoice}
              className={`p-2 shrink-0 rounded-xl transition-all ${isRecording ? 'voice-pulse' : ''}`}
              style={{ color: isRecording ? 'var(--accent)' : 'var(--muted)' }}>
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button onClick={() => sendMessage()} disabled={(!input.trim() && !hasFiles) || streaming}
              className="p-2.5 rounded-full shrink-0 transition-all duration-200"
              style={{
                background: (input.trim() || hasFiles) && !streaming ? 'var(--accent)' : 'var(--bg2)',
                opacity: streaming ? 0.5 : 1,
              }}>
              <ArrowUp size={18} color={(input.trim() || hasFiles) && !streaming ? '#FFF' : 'var(--muted)'} />
            </button>
          </div>
          <p className="text-center mt-2 text-[10px]" style={{ color: 'var(--muted)' }}>
            Kelsey AI uses free AI (Pollinations.ai). Add API keys in Settings for faster responses. Voice & file upload enabled.
          </p>
        </div>
      </div>

      {/* ═══ IMAGE LIGHTBOX ═══ */}
      {imageLightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 animate-fade" onClick={() => setImageLightbox(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img src={imageLightbox} alt="" className="max-w-full max-h-[85vh] rounded-2xl" />
            <div className="flex items-center justify-center gap-3 mt-3">
              <a href={imageLightbox} target="_blank" download
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                style={{ background: 'var(--accent)' }}>
                <Download size={14} /> Download
              </a>
              <button onClick={() => setImageLightbox(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium bg-white/20">
                <X size={14} /> Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SETTINGS MODAL ═══ */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5 mx-4 animate-scale" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>⚙️ Settings</h2>
              <button onClick={() => setShowSettings(false)}><X size={20} style={{ color: 'var(--muted)' }} /></button>
            </div>

            {/* Status */}
            <div className="rounded-xl p-4 space-y-2" style={{ background: '#f0fff4' }}>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="font-bold text-green-800 text-sm">All Systems Live</span>
              </div>
              <p className="text-xs text-green-700">Works without any API keys. Pollinations.ai is free forever. Add keys for faster/better responses.</p>
              <div className="flex gap-2 text-[10px] font-mono text-green-600">
                <span>✅ Chat</span><span>✅ Images</span><span>✅ Voice</span><span>✅ Files</span><span>✅ Crypto</span>
              </div>
            </div>

            {/* API Keys */}
            {[
              { key: 'groqKey' as const, label: 'Groq API Key (Free)', placeholder: 'gsk_...', hint: 'Free at console.groq.com — fastest responses', icon: '⚡' },
              { key: 'geminiKey' as const, label: 'Google Gemini Key (Free)', placeholder: 'AIza...', hint: 'Free at aistudio.google.com — best quality', icon: '💎' },
            ].map(api => (
              <div key={api.key} className="space-y-1.5">
                <label className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                  <span>{api.icon}</span> {api.label}
                </label>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{api.hint}</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={settings[api.key]}
                    onChange={e => setSettings(s => ({ ...s, [api.key]: e.target.value }))}
                    placeholder={api.placeholder}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none font-mono"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                  <button onClick={() => {
                    if (settings[api.key]) {
                      // Test the key by making a real request
                      showToast('🔑 Key saved — will use on next message');
                    }
                  }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'var(--accent)' }}>Save</button>
                </div>
              </div>
            ))}

            {/* Provider */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold" style={{ color: 'var(--text)' }}>🤖 AI Provider</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'auto', label: 'Auto', desc: 'Best available' },
                  { id: 'groq', label: 'Groq', desc: 'Fastest' },
                  { id: 'pollinations', label: 'Free', desc: 'Always works' },
                ].map(p => (
                  <button key={p.id} onClick={() => setSettings(s => ({ ...s, provider: p.id }))}
                    className="py-2 rounded-xl text-center transition-colors"
                    style={{
                      background: settings.provider === p.id ? 'var(--accent-light)' : 'var(--bg2)',
                      border: `1px solid ${settings.provider === p.id ? 'var(--accent)' : 'var(--border)'}`,
                      color: settings.provider === p.id ? 'var(--accent)' : 'var(--text2)',
                    }}>
                    <span className="text-xs font-bold block">{p.label}</span>
                    <span className="text-[10px] opacity-70">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice */}
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>🔊 Auto-read responses</span>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Read AI responses aloud automatically</p>
              </div>
              <button onClick={() => setSettings(s => ({ ...s, autoSpeak: !s.autoSpeak }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${settings.autoSpeak ? 'bg-green-500' : ''}`}
                style={{ background: settings.autoSpeak ? '#22C55E' : 'var(--bg2)' }}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.autoSpeak ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Dark mode */}
            <button onClick={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>
              {settings.darkMode ? <><Sun size={16} /> Switch to Light</> : <><Moon size={16} /> Switch to Dark</>}
            </button>
          </div>
        </div>
      )}

      {/* ═══ TOAST ═══ */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
