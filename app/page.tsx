'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  MessageCircle, Send, Plus, Image, Mic, Code, Globe, Rocket,
  Menu, X, Settings, FolderOpen, Cpu, BookOpen, Link, Sparkles,
  ChevronDown, ChevronUp, Copy, Check, Terminal, Play, Download,
  TrendingUp, Coins, Share2, Palette, Bot, Search, Moon, Sun,
  Upload, FileText, Zap, Hash, Instagram, Twitter, Facebook,
  Youtube, Linkedin, Github, ArrowUp, Paperclip, MicOff, Camera
} from 'lucide-react';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

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

type Tab = 'chat' | 'code' | 'deploy' | 'social' | 'crypto' | 'media' | 'agents' | 'settings';
type SidebarView = 'chats' | 'agents' | 'skills' | 'connectors' | 'settings';

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════

export default function KelseyAI() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>('chats');
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [darkMode, setDarkMode] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatingImg, setGeneratingImg] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Auto scroll
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamText]);

  // ─── Send Message ───────────────────────────────────

  const sendMessage = useCallback(async (content?: string) => {
    const text = content || input.trim();
    if (!text || streaming) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamText('');

    // Auto-detect what kind of task this is
    const isImageGen = /\b(generate|create|make|draw|render)\b.*\b(image|picture|photo|pic|illustration|artwork|portrait|girl|woman|man|person)\b/i.test(text);
    const isCrypto = /\b(crypto|bitcoin|ethereum|token|smart.contract|defi|nft|wallet|blockchain|web3|solana)\b/i.test(text);
    const isSocial = /\b(social.media|instagram|tiktok|post|caption|hashtag|persona|content.calendar|followers|engagement)\b/i.test(text);
    const isCode = /\b(code|build|create|develop|program|function|api|app|website|script)\b/i.test(text);

    try {
      let endpoint = '/api/chat';
      let body: any = {
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
      };

      if (isImageGen) {
        // Also generate image alongside chat
        handleImageGeneration(text);
      }

      if (isCrypto) {
        endpoint = '/api/tools';
        body = { action: 'default', prompt: text };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('API error');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.event === 'token' && data.delta) {
                  fullText += data.delta;
                  setStreamText(fullText);
                }
              } catch {}
            }
          }
        }
      }

      const assistantMsg: Message = {
        id: `msg_${Date.now()}_asst`,
        role: 'assistant',
        content: fullText || 'I received your message but got an empty response. Please try again.',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      const errorMsg: Message = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: `⚠️ Connection error: ${error.message}\n\nMake sure the API routes are working. The app uses **free AI providers** (Pollinations, Groq) — no API keys required to start!\n\nAdd a free Groq key in Settings for faster responses.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setStreaming(false);
      setStreamText('');
    }
  }, [input, messages, streaming]);

  // ─── Image Generation ───────────────────────────────

  const handleImageGeneration = async (prompt: string) => {
    setGeneratingImg(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, width: 1024, height: 1024 }),
      });
      const data = await res.json();
      if (data.url) {
        setGeneratedImages(prev => [data.url, ...prev]);
      }
    } catch (e) {
      console.error('Image gen failed:', e);
    } finally {
      setGeneratingImg(false);
    }
  };

  // ─── Copy ───────────────────────────────────────────

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ─── New Chat ───────────────────────────────────────

  const newChat = () => {
    if (messages.length > 0) {
      setChats(prev => [{
        id: `chat_${Date.now()}`,
        title: messages[0]?.content.slice(0, 50) || 'New Chat',
        messages: [...messages],
        createdAt: Date.now(),
      }, ...prev]);
    }
    setMessages([]);
    setCurrentChat(null);
    setSidebarOpen(false);
  };

  // ─── Quick Actions ──────────────────────────────────

  const quickActions = [
    { icon: <Code size={16} />, label: 'Build an app', prompt: 'Build me a complete React dashboard with sidebar, charts, and data tables. Include all code.' },
    { icon: <Globe size={16} />, label: 'Clone a website', prompt: 'I want to clone a website. What URL should I recreate for you?' },
    { icon: <Camera size={16} />, label: 'Generate image', prompt: 'Generate a photorealistic image of ' },
    { icon: <Share2 size={16} />, label: 'Social media', prompt: 'Create a complete social media persona for a lifestyle influencer with bio, 10 post ideas, content calendar, and hashtag strategy.' },
    { icon: <Coins size={16} />, label: 'Crypto tools', prompt: 'Show me the current crypto market data and trending coins.' },
    { icon: <Terminal size={16} />, label: 'Kali Linux', prompt: 'List the top 20 Kali Linux tools with usage examples and commands.' },
    { icon: <Rocket size={16} />, label: 'Deploy app', prompt: 'I want to deploy my application. Help me set up deployment to Render.' },
    { icon: <Palette size={16} />, label: 'Design system', prompt: 'Create a complete design system with colors, typography, components, and tokens for a modern SaaS app.' },
  ];

  const isLanding = messages.length === 0;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>
      {/* ─── SIDEBAR ─── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ width: 280, background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                <Sparkles size={18} color="#FFF" />
              </div>
              <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>Kelsey AI</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded-lg hover:opacity-70">
              <X size={20} style={{ color: 'var(--muted)' }} />
            </button>
          </div>

          {/* New Chat */}
          <div className="px-3 mb-3">
            <button
              onClick={newChat}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-sm"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={18} /> New Chat
            </button>
          </div>

          {/* Search */}
          <div className="px-3 mb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <Search size={14} style={{ color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent outline-none flex-1 text-sm"
                style={{ color: 'var(--text)' }}
              />
            </div>
          </div>

          {/* Nav */}
          <div className="px-3 space-y-0.5">
            {[
              { icon: <MessageCircle size={18} />, label: 'Chats', view: 'chats' as SidebarView },
              { icon: <Cpu size={18} />, label: 'Agents (475)', view: 'agents' as SidebarView },
              { icon: <BookOpen size={18} />, label: 'Skills', view: 'skills' as SidebarView },
              { icon: <Link size={18} />, label: 'Connectors', view: 'connectors' as SidebarView },
              { icon: <Settings size={18} />, label: 'Settings', view: 'settings' as SidebarView },
            ].map(item => (
              <button
                key={item.view}
                onClick={() => setSidebarView(item.view)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
                style={{
                  background: sidebarView === item.view ? 'var(--accent-light)' : 'transparent',
                  color: sidebarView === item.view ? 'var(--accent)' : 'var(--text2)',
                }}
              >
                {item.icon}
                <span className={sidebarView === item.view ? 'font-semibold' : ''}>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="my-3 mx-4" style={{ borderBottom: '1px solid var(--border)' }} />

          {/* Recent Chats */}
          <div className="flex-1 overflow-y-auto px-3">
            <p className="text-[11px] font-semibold tracking-wider px-3 py-2" style={{ color: 'var(--muted)' }}>RECENT</p>
            {chats.slice(0, 15).map(chat => (
              <button
                key={chat.id}
                onClick={() => { setMessages(chat.messages); setCurrentChat(chat.id); setSidebarOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm truncate hover:opacity-80 transition-colors"
                style={{ color: 'var(--text2)' }}
              >
                {chat.title}
              </button>
            ))}
          </div>

          {/* Bottom */}
          <div className="p-3 flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl transition-colors"
              style={{ background: 'var(--bg2)' }}
            >
              {darkMode ? <Sun size={18} style={{ color: 'var(--accent)' }} /> : <Moon size={18} style={{ color: 'var(--muted)' }} />}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── MAIN ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1">
              <Menu size={22} style={{ color: 'var(--text)' }} />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles size={20} style={{ color: 'var(--accent)' }} />
              <span className="font-bold" style={{ color: 'var(--text)' }}>Kelsey AI</span>
              {streaming && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[
              { icon: <MessageCircle size={18} />, tab: 'chat' as Tab },
              { icon: <Code size={18} />, tab: 'code' as Tab },
              { icon: <Image size={18} />, tab: 'media' as Tab },
              { icon: <Share2 size={18} />, tab: 'social' as Tab },
              { icon: <Coins size={18} />, tab: 'crypto' as Tab },
              { icon: <Cpu size={18} />, tab: 'agents' as Tab },
              { icon: <Rocket size={18} />, tab: 'deploy' as Tab },
            ].map(item => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className="p-2 rounded-lg transition-colors"
                style={{
                  background: activeTab === item.tab ? 'var(--accent-light)' : 'transparent',
                  color: activeTab === item.tab ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {item.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' && (
            <ChatView
              messages={messages}
              streaming={streaming}
              streamText={streamText}
              isLanding={isLanding}
              input={input}
              setInput={setInput}
              sendMessage={sendMessage}
              chatRef={chatRef}
              copiedId={copiedId}
              copyCode={copyCode}
              quickActions={quickActions}
              generatedImages={generatedImages}
              generatingImg={generatingImg}
              imagePrompt={imagePrompt}
              setImagePrompt={setImagePrompt}
              handleImageGeneration={handleImageGeneration}
            />
          )}
          {activeTab === 'agents' && <AgentsView />}
          {activeTab === 'media' && <MediaView prompt={imagePrompt} setPrompt={setImagePrompt} generate={handleImageGeneration} images={generatedImages} generating={generatingImg} />}
          {activeTab === 'social' && <SocialView sendMessage={sendMessage} />}
          {activeTab === 'crypto' && <CryptoView sendMessage={sendMessage} />}
          {activeTab === 'deploy' && <DeployView sendMessage={sendMessage} />}
          {activeTab === 'code' && <CodeWorkspace sendMessage={sendMessage} />}
          {activeTab === 'settings' && <SettingsView darkMode={darkMode} setDarkMode={setDarkMode} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CHAT VIEW
// ═══════════════════════════════════════════════════════

function ChatView({ messages, streaming, streamText, isLanding, input, setInput, sendMessage, chatRef, copiedId, copyCode, quickActions, generatedImages, generatingImg, imagePrompt, setImagePrompt, handleImageGeneration }: any) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto">
        {isLanding ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-6 animate-in">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <Sparkles size={40} color="#FFF" />
            </div>
            <h1 className="text-3xl font-bold text-center" style={{ color: 'var(--text)' }}>
              {getGreeting()}
            </h1>
            <p className="text-center max-w-md" style={{ color: 'var(--text2)' }}>
              Your AI workspace — code, create, deploy, generate images, social media, crypto tools, and more.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mt-2">
              {quickActions.map((action: any, i: number) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.prompt)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all hover:scale-105"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)' }}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-[900px] mx-auto py-6 px-4 space-y-6">
            {messages.map((msg: Message) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mr-3 mt-1" style={{ background: 'var(--accent)' }}>
                    <Sparkles size={16} color="#FFF" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] ${msg.role === 'user' ? 'rounded-[20px] rounded-br-sm' : ''}`}
                  style={{
                    background: msg.role === 'user' ? 'var(--user-bubble)' : 'transparent',
                    padding: msg.role === 'user' ? '14px 20px' : '0',
                    color: 'var(--text)',
                  }}
                >
                  {msg.role === 'user' ? (
                    <p className="text-[16px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none" style={{ color: 'var(--text)' }}>
                      <ReactMarkdown
                        components={{
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeString = String(children).replace(/\n$/, '');
                            if (match) {
                              return (
                                <div className="relative group">
                                  <button
                                    onClick={() => navigator.clipboard.writeText(codeString)}
                                    className="absolute top-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ background: 'rgba(255,255,255,0.1)' }}
                                  >
                                    {copiedId === msg.id ? <Check size={14} color="#22C55E" /> : <Copy size={14} color="#888" />}
                                  </button>
                                  <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
                                    {codeString}
                                  </SyntaxHighlighter>
                                </div>
                              );
                            }
                            return <code className={className} {...props}>{children}</code>;
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {/* Attached images */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {msg.images.map((url: string, i: number) => (
                        <img key={i} src={url} alt="" className="w-48 h-48 rounded-xl object-cover" />
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

      {/* Generated Images Preview */}
      {generatedImages.length > 0 && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto" style={{ borderTop: '1px solid var(--border)' }}>
          {generatedImages.slice(0, 5).map((url: string, i: number) => (
            <img key={i} src={url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <div
          className="flex items-end gap-2 p-2 rounded-[30px]"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}
        >
          <button className="p-2 rounded-xl shrink-0" style={{ background: 'var(--bg2)' }}>
            <Plus size={20} style={{ color: 'var(--text2)' }} />
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Kelsey anything..."
            className="flex-1 resize-none bg-transparent outline-none text-[16px] leading-relaxed py-2 px-2 max-h-[140px] min-h-[40px]"
            style={{ color: 'var(--text)' }}
            rows={1}
          />
          <button className="p-2 shrink-0" style={{ color: 'var(--muted)' }}>
            <Paperclip size={20} />
          </button>
          <button className="p-2 shrink-0" style={{ color: 'var(--muted)' }}>
            <Mic size={20} />
          </button>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            className="p-2.5 rounded-full shrink-0 transition-colors"
            style={{ background: input.trim() ? 'var(--accent)' : 'var(--bg2)' }}
          >
            <ArrowUp size={18} color={input.trim() ? '#FFF' : 'var(--muted)'} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MEDIA VIEW (Image Generation)
// ═══════════════════════════════════════════════════════

function MediaView({ prompt, setPrompt, generate, images, generating }: any) {
  const styles = ['Realistic', 'Anime', '3D Render', 'Cyberpunk', 'Oil Painting', 'Watercolor', 'Pixel Art', 'Sketch', 'Cinematic', 'Fantasy'];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🎨 Image Generation</h2>
      <p className="text-sm" style={{ color: 'var(--text2)' }}>Powered by Pollinations.ai — 100% free, no API key needed</p>

      <div className="rounded-2xl p-4 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate... (e.g., 'A realistic portrait of a young woman with brown hair, smiling, natural lighting, professional photo')"
          className="w-full resize-none bg-transparent outline-none text-[16px] leading-relaxed p-2 min-h-[100px]"
          style={{ color: 'var(--text)' }}
        />
        <div className="flex flex-wrap gap-2">
          {styles.map(s => (
            <button key={s} onClick={() => setPrompt((p: string) => p + (p ? ', ' : '') + s.toLowerCase())}
              className="px-3 py-1.5 rounded-full text-xs" style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => generate(prompt)}
          disabled={!prompt.trim() || generating}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors"
          style={{ background: prompt.trim() ? 'var(--accent)' : 'var(--bg2)', color: prompt.trim() ? '#FFF' : 'var(--muted)' }}
        >
          {generating ? '✨ Generating...' : <><Image size={18} /> Generate</>}
        </button>
      </div>

      {/* Gallery */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((url: string, i: number) => (
            <div key={i} className="rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              <img src={url} alt="" className="w-full aspect-square object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SOCIAL MEDIA VIEW
// ═══════════════════════════════════════════════════════

function SocialView({ sendMessage }: any) {
  const platforms = [
    { icon: <Instagram size={20} />, name: 'Instagram', color: '#E4405F' },
    { icon: <Twitter size={20} />, name: 'TikTok/X', color: '#000' },
    { icon: <Facebook size={20} />, name: 'Facebook', color: '#1877F2' },
    { icon: <Youtube size={20} />, name: 'YouTube', color: '#FF0000' },
    { icon: <Linkedin size={20} />, name: 'LinkedIn', color: '#0A66C2' },
  ];

  const actions = [
    { label: '🎭 Create AI Persona', prompt: 'Create a detailed, realistic social media persona for a lifestyle/fashion influencer. Include full name, age, bio (150 words), 15 post ideas with captions, content calendar, hashtag strategy, and engagement tactics. Make it feel like a REAL person.' },
    { label: '📝 Generate Posts', prompt: 'Generate 10 realistic Instagram posts with captions, hashtags, best posting times, and image descriptions for a lifestyle brand.' },
    { label: '📅 Content Calendar', prompt: 'Create a 30-day content calendar for Instagram and TikTok for a tech/lifestyle brand. Include: date, time, content type, caption, hashtags, visual description.' },
    { label: '#️⃣ Hashtag Research', prompt: 'Research and provide 100 hashtags for Instagram in the lifestyle/fashion niche. Categorize: high-volume (1M+), medium (100K-1M), niche (<100K).' },
    { label: '💰 Monetization', prompt: 'Create a monetization strategy for a social media influencer with 100K followers. Include: brand deals, affiliate marketing, digital products, courses, and subscription models with realistic pricing.' },
    { label: '🚀 Growth Strategy', prompt: 'Create a 90-day growth strategy for a new Instagram account targeting 10K followers. Include daily actions, content pillars, engagement tactics, and analytics milestones.' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>📱 Social Media Tools</h2>

      <div className="flex gap-3">
        {platforms.map(p => (
          <div key={p.name} className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: p.color + '15', border: `1px solid ${p.color}30` }}>
            <div style={{ color: p.color }}>{p.icon}</div>
            <span className="text-sm font-medium" style={{ color: p.color }}>{p.name}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={() => sendMessage(a.prompt)}
            className="text-left p-4 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CRYPTO VIEW
// ═══════════════════════════════════════════════════════

function CryptoView({ sendMessage }: any) {
  const [marketData, setMarketData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMarket();
  }, []);

  const loadMarket = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'market', data: {} }),
      });
      const data = await res.json();
      setMarketData(data.markets || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const actions = [
    { label: '⛓️ Smart Contract', prompt: 'Generate a complete ERC-20 token smart contract with minting, burning, staking, governance, and anti-whale mechanisms. Include full Solidity code.' },
    { label: '📊 Tokenomics Design', prompt: 'Design a detailed tokenomics model for a new DeFi project. Include token distribution, vesting, utility, staking rewards, and ROI projections.' },
    { label: '💹 DeFi Strategy', prompt: 'Create a DeFi yield farming strategy with step-by-step instructions for maximizing returns while managing risk. Include specific protocols and APY estimates.' },
    { label: '🔍 Token Analysis', prompt: 'Provide a framework for analyzing cryptocurrency tokens before investing. Include fundamental analysis, on-chain metrics, team evaluation, and risk assessment.' },
    { label: '🪙 Create Meme Token', prompt: 'Create a complete meme token project: token name, contract code, website copy, social media strategy, launch plan, and marketing budget.' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>💰 Crypto Tools</h2>
        <button onClick={loadMarket} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>
          <TrendingUp size={16} /> Refresh
        </button>
      </div>

      {/* Market Data */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="p-4 font-semibold" style={{ borderBottom: '1px solid var(--border)' }}>📊 Live Market (CoinGecko)</div>
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>Loading market data...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left p-3 font-medium" style={{ color: 'var(--muted)' }}>#</th>
                  <th className="text-left p-3 font-medium" style={{ color: 'var(--muted)' }}>Coin</th>
                  <th className="text-right p-3 font-medium" style={{ color: 'var(--muted)' }}>Price</th>
                  <th className="text-right p-3 font-medium" style={{ color: 'var(--muted)' }}>24h %</th>
                  <th className="text-right p-3 font-medium" style={{ color: 'var(--muted)' }}>Market Cap</th>
                </tr>
              </thead>
              <tbody>
                {marketData.slice(0, 10).map((coin: any) => (
                  <tr key={coin.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="p-3" style={{ color: 'var(--muted)' }}>{coin.market_cap_rank}</td>
                    <td className="p-3 font-medium flex items-center gap-2">
                      <img src={coin.image} alt="" className="w-6 h-6 rounded-full" />
                      <span style={{ color: 'var(--text)' }}>{coin.name}</span>
                      <span className="uppercase text-xs" style={{ color: 'var(--muted)' }}>{coin.symbol}</span>
                    </td>
                    <td className="p-3 text-right font-mono" style={{ color: 'var(--text)' }}>
                      ${coin.current_price?.toLocaleString()}
                    </td>
                    <td className={`p-3 text-right font-mono ${(coin.price_change_percentage_24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {(coin.price_change_percentage_24h || 0).toFixed(2)}%
                    </td>
                    <td className="p-3 text-right font-mono" style={{ color: 'var(--text2)' }}>
                      ${(coin.market_cap / 1e9).toFixed(1)}B
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={() => sendMessage(a.prompt)}
            className="text-left p-4 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// AGENTS VIEW
// ═══════════════════════════════════════════════════════

function AgentsView() {
  const categories = [
    { icon: '⚡', name: 'Core Intelligence', count: 20 },
    { icon: '💻', name: 'Code Generation', count: 40 },
    { icon: '🔍', name: 'Review & QA', count: 30 },
    { icon: '🏗️', name: 'Architecture', count: 25 },
    { icon: '🚀', name: 'DevOps', count: 30 },
    { icon: '🛡️', name: 'Security', count: 35 },
    { icon: '📊', name: 'Data & Analytics', count: 30 },
    { icon: '🎨', name: 'Design & UI/UX', count: 35 },
    { icon: '✍️', name: 'Content & Writing', count: 25 },
    { icon: '📚', name: 'Research', count: 25 },
    { icon: '📱', name: 'Mobile Dev', count: 20 },
    { icon: '🌐', name: 'Web Dev', count: 25 },
    { icon: '☁️', name: 'Cloud & Servers', count: 20 },
    { icon: '🤖', name: 'AI & ML', count: 25 },
    { icon: '🗄️', name: 'Database', count: 15 },
    { icon: '⛓️', name: 'Blockchain', count: 15 },
    { icon: '🎮', name: 'Game Dev', count: 10 },
    { icon: '📣', name: 'Social & Marketing', count: 15 },
    { icon: '⚙️', name: 'Automation', count: 15 },
    { icon: '🐧', name: 'Kali Linux', count: 20 },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🤖 475 AI Agents</h2>
        <span className="text-sm font-medium px-3 py-1 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>20 Categories</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {categories.map(cat => (
          <div
            key={cat.name}
            className="p-4 rounded-2xl text-center space-y-2"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <span className="text-2xl">{cat.icon}</span>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{cat.name}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{cat.count} agents</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DEPLOY VIEW
// ═══════════════════════════════════════════════════════

function DeployView({ sendMessage }: any) {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🚀 Deployment</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { name: 'Render', icon: '🎯', prompt: 'Help me deploy my Next.js app to Render. Provide the complete render.yaml, build command, start command, and environment variables needed.' },
          { name: 'Vercel', icon: '▲', prompt: 'Help me deploy my app to Vercel. Provide the vercel.json config and deployment steps.' },
          { name: 'Railway', icon: '🚂', prompt: 'Help me deploy my app to Railway. Provide the railway.json config and deployment steps.' },
          { name: 'Docker', icon: '🐳', prompt: 'Create a production Dockerfile and docker-compose.yml for my application with multi-stage build, health checks, and optimized layers.' },
          { name: 'AWS', icon: '☁️', prompt: 'Help me deploy to AWS. Provide CloudFormation/CDK template for a scalable web application.' },
          { name: 'CI/CD Pipeline', icon: '🔄', prompt: 'Create a complete GitHub Actions CI/CD pipeline with testing, building, and deployment stages.' },
        ].map(d => (
          <button
            key={d.name}
            onClick={() => sendMessage(d.prompt)}
            className="text-left p-5 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <span className="text-2xl">{d.icon}</span>
            <p className="font-semibold mt-2" style={{ color: 'var(--text)' }}>{d.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CODE WORKSPACE
// ═══════════════════════════════════════════════════════

function CodeWorkspace({ sendMessage }: any) {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>💻 Code Workspace</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { label: '⚡ Full-Stack App', prompt: 'Build me a complete full-stack application with Next.js, API routes, database schema, authentication, and deployment config. Include ALL files.' },
          { label: '📱 Mobile App', prompt: 'Build a complete React Native mobile app with Expo, navigation, screens, API integration, and deployment config.' },
          { label: '🐍 Python API', prompt: 'Build a complete FastAPI backend with authentication, CRUD operations, database models, middleware, and Docker config.' },
          { label: '🔗 API Server', prompt: 'Build a complete REST API with Express.js, authentication, rate limiting, validation, error handling, and documentation.' },
          { label: '🎮 Game', prompt: 'Build a complete browser game with HTML5 Canvas, game loop, physics, and scoring system.' },
          { label: '🤖 Bot', prompt: 'Build a complete Discord/Telegram bot with commands, event handlers, and database integration.' },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => sendMessage(item.prompt)}
            className="text-left p-4 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SETTINGS VIEW
// ═══════════════════════════════════════════════════════

function SettingsView({ darkMode, setDarkMode }: { darkMode: boolean; setDarkMode: (v: boolean) => void }) {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>⚙️ Settings</h2>

      {/* Free API Info */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#F0FFF4', border: '1px solid #22C55E30' }}>
        <p className="font-bold text-green-700">✅ Works Without API Keys!</p>
        <p className="text-sm text-green-600">
          Kelsey AI uses <strong>Pollinations.ai</strong> (100% free, no signup) by default.
          Add a free Groq API key below for faster, higher-quality responses.
        </p>
      </div>

      {/* API Keys */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>🔑 API Keys (Optional)</h3>

        {[
          { name: 'Groq (Free — Recommended)', key: 'GROQ_API_KEY', desc: 'Get free key at console.groq.com', placeholder: 'gsk_...' },
          { name: 'Google Gemini (Free)', key: 'GEMINI_API_KEY', desc: 'Get free key at aistudio.google.com', placeholder: 'AIza...' },
          { name: 'HuggingFace (Free)', key: 'HF_API_KEY', desc: 'Get free key at huggingface.co', placeholder: 'hf_...' },
        ].map(api => (
          <div key={api.key} className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{api.name}</label>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{api.desc}</p>
            <input
              type="password"
              placeholder={api.placeholder}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onChange={e => {
                // Store in env for this session
                (process.env as any)[api.key] = e.target.value;
              }}
            />
          </div>
        ))}
      </div>

      {/* Appearance */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>🎨 Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Dark Mode</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Toggle between light and dark theme</p>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-12 h-7 rounded-full relative transition-colors"
            style={{ background: darkMode ? 'var(--accent)' : 'var(--border)' }}
          >
            <div className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform" style={{ transform: darkMode ? 'translateX(22px)' : 'translateX(2px)' }} />
          </button>
        </div>
      </div>

      {/* About */}
      <div className="rounded-2xl p-5 space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>ℹ️ About</h3>
        <p className="text-sm" style={{ color: 'var(--text2)' }}>Kelsey AI v1.0 — Premium AI Workspace</p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>475 agents • 20 categories • Free AI • Deploy anywhere</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning. What shall we build?';
  if (h < 17) return 'Good afternoon. What are we creating?';
  return 'Good evening. What can I help with?';
}
