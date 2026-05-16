'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, Send, Sparkles, RotateCcw, Loader2 } from 'lucide-react';
import { apiFetch, API_BASE } from '@/lib/api';
import { Markdown } from '@/components/ui/markdown';

const suggestedPrompts = [
  'Show attack paths to production database',
  'Which CVEs are actively exploited?',
  'What is the blast radius of CVE-2024-0001?',
  'List all internet-facing assets with critical vulnerabilities',
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AnalystPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;
    
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setIsLoading(true);

    try {
      // Use apiFetch to handle auth cookies and x-tenant-id automatically
      const data = await apiFetch<any>('/ai/nl-to-cypher', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });

      let finalContent = '';
      if (data.interpretation) {
         finalContent = `**Graph Query Generated:**\n\`\`\`cypher\n${data.cypher}\n\`\`\`\n\n${data.interpretation}`;
      } else {
         // Fallback to chat stream if NL-to-Cypher didn't work well
         const streamRes = await fetch(`${API_BASE}/ai/chat/stream`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-tenant-id': typeof window !== 'undefined' ? window.localStorage.getItem('argus.activeTenantId') || '' : ''
            },
            credentials: 'include',
            body: JSON.stringify({ message: text }),
          });
    
          if (!streamRes.ok) throw new Error('Stream request failed');
          if (!streamRes.body) throw new Error('No stream body');
    
          const reader = streamRes.body.getReader();
          const decoder = new TextDecoder();
    
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            setMessages((prev) => {
              const newMsgs = [...prev];
              const lastMsg = newMsgs[newMsgs.length - 1]!;
              lastMsg.content += chunk;
              return newMsgs;
            });
          }
          setIsLoading(false);
          return;
      }

      setMessages((prev) => {
        const newMsgs = [...prev];
        const lastMsg = newMsgs[newMsgs.length - 1]!;
        lastMsg.content = finalContent;
        return newMsgs;
      });
      
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => {
        const newMsgs = [...prev];
        const lastMsg = newMsgs[newMsgs.length - 1]!;
        lastMsg.content = 'Sorry, I encountered an error while processing your request. Please check your API keys and try again.';
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Analyst</h1>
          <p className="text-sm text-muted-foreground mt-1">Natural language security intelligence</p>
        </div>
        <button onClick={() => setMessages([])} className="flex items-center gap-2 rounded-lg bg-card-border/5 px-3 py-2 text-sm text-muted-foreground ring-1 ring-card-border hover:bg-card-border/10 hover:text-foreground">
          <RotateCcw className="h-4 w-4" /> New Session
        </button>
      </div>

      <div className="flex-1 glass-card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500/15 to-accent-500/15 ring-1 ring-primary-500/20">
                <BrainCircuit className="h-10 w-10 text-primary-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Ask your security graph</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-8">Query your infrastructure using natural language. ARGUS converts questions into graph queries.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-xl w-full">
                {suggestedPrompts.map((p) => (
                  <button key={p} onClick={() => handleSend(p)} className="flex items-center gap-2 rounded-xl bg-card-border/5 px-4 py-3 text-left text-sm text-muted-foreground ring-1 ring-card-border hover:bg-card-border/10 hover:text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary-500 shrink-0" />
                    <span className="truncate">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-primary-500/15 text-foreground ring-1 ring-primary-500/30' : 'bg-card-border/5 text-foreground ring-1 ring-card-border'}`}>
                  {msg.role === 'assistant' ? (
                    msg.content ? (
                      <Markdown content={msg.content} />
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Analyzing graph data...
                      </div>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </motion.div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-card-border p-4">
          <div className="flex items-center gap-3">
            <input 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); }}} 
              placeholder="Ask about your security posture..." 
              disabled={isLoading}
              className="flex-1 rounded-xl bg-card-border/5 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-card-border focus:ring-primary-500/30 disabled:opacity-50" 
            />
            <button 
              onClick={() => handleSend()} 
              disabled={isLoading || !input.trim()}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/30 hover:bg-primary-500/30 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
