import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, X, Send, Sparkles, RotateCcw, Copy, Check,
  Edit3, Volume2, VolumeX, Mic, MicOff
} from 'lucide-react';
import api from '../api';
import { useDialog } from '../context/DialogContext';
import './AIChatWidget.css';

const QUICK_PROMPTS = [
  { label: '🔍 Spending Audit', query: 'Run a comprehensive spending audit across my transactions and budgets.' },
  { label: '🚨 Category Spikes', query: 'Identify any category spending spikes or abnormal spending this month.' },
  { label: '📊 Month-over-Month', query: 'Give me a month-over-month comparison of my income and expenses.' },
  { label: '💡 Savings Advice', query: 'Based on my top expenses, how can I save more money this month?' },
  { label: '⚠️ Budget Health', query: 'Am I over budget or near the limit on any category?' },
  { label: '👥 Split & Debts', query: 'Who owes me money and what do I owe in split groups?' }
];

function FormattedText({ text, isStreaming }) {
  if (!text && !isStreaming) return null;

  const lines = (text || '').split('\n');
  return (
    <div className="formatted-chat-text">
      {lines.map((line, lIdx) => {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        const renderedLine = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*');
        return (
          <div key={lIdx} className={isBullet ? 'chat-bullet-line' : 'chat-line'}>
            {renderedLine}
          </div>
        );
      })}
      {isStreaming && <span className="streaming-cursor" />}
    </div>
  );
}

export default function AIChatWidget() {
  const { showAlert } = useDialog();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "👋 Hi! I'm FinanceOS AI. I have live access to your real-time transactions, category budgets, savings goals, and group split debts. How can I help you today?",
      isStreaming: false
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Clean up speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleClearChat = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeakingIdx(null);
    setMessages([
      {
        sender: 'ai',
        text: "Chat cleared! How can I assist you with your finances today?",
        isStreaming: false
      }
    ]);
  };

  const handleCopyText = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  const handleEditMessage = (text) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleSpeakText = (text, idx) => {
    if (!('speechSynthesis' in window)) {
      showAlert({
        title: 'Feature Not Supported',
        message: 'Text-to-speech audio is not supported in this browser.',
        type: 'warning',
      });
      return;
    }

    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }

    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_#•]/g, '').trim();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 1.0;
    utter.onend = () => setSpeakingIdx(null);
    utter.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utter);
  };

  const toggleVoiceAssistant = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showAlert({
        title: 'Voice Assistant',
        message: 'Voice assistant input requires Google Chrome or a browser supporting the Web Speech API.',
        type: 'info',
      });
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const handleSendPrompt = async (promptText) => {
    if (!promptText.trim() || loading) return;

    const userMsg = promptText.trim();
    setInput('');
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setMessages(prev => [
      ...prev,
      { sender: 'user', text: userMsg },
      { sender: 'ai', text: '', isStreaming: true }
    ]);
    setLoading(true);

    const token = localStorage.getItem('token');
    const baseUrl = api.defaults.baseURL || 'http://localhost:8000';

    try {
      const response = await fetch(`${baseUrl}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: userMsg })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let receivedAny = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              const chunkText = parsed.text ?? parsed.chunk ?? '';
              if (chunkText) {
                receivedAny = true;
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].sender === 'ai') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      text: (updated[lastIdx].text || '') + chunkText,
                      isStreaming: true
                    };
                  }
                  return updated;
                });
              }
            } catch (e) {
              // Ignore malformed chunks
            }
          }
        }
      }

      if (!receivedAny) {
        // Stream completed without chunks, fetch from standard endpoint
        const fallbackRes = await api.post('/ai/chat', { message: userMsg });
        const fallbackText = fallbackRes.data?.response || "I've reviewed your financial context, but couldn't generate a response.";
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].sender === 'ai') {
            updated[lastIdx] = { sender: 'ai', text: fallbackText, isStreaming: false };
          }
          return updated;
        });
      } else {
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].sender === 'ai') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              isStreaming: false
            };
          }
          return updated;
        });
      }
    } catch (err) {
      console.warn('AI Streaming error, falling back to standard API:', err);
      try {
        const fallbackRes = await api.post('/ai/chat', { message: userMsg });
        const fallbackText = fallbackRes.data?.response || "I've reviewed your financial context, but couldn't generate a response.";
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].sender === 'ai') {
            updated[lastIdx] = { sender: 'ai', text: fallbackText, isStreaming: false };
          }
          return updated;
        });
      } catch (fallbackErr) {
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].sender === 'ai') {
            updated[lastIdx] = {
              sender: 'ai',
              text: "Sorry, I'm having trouble retrieving your financial activity right now. Please check your connection and try again.",
              isStreaming: false
            };
          }
          return updated;
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleSendPrompt(input);
  };

  return (
    <div className="ai-chat-container">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button className="ai-chat-toggle" onClick={() => setIsOpen(true)} title="Ask Financial AI">
          <Sparkles className="sparkle-icon" size={20} />
          <span>Ask AI</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="ai-chat-window glass-panel animate-slide-up">
          {/* Header */}
          <div className="ai-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div className="ai-avatar"><Bot size={18} /></div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>FinanceOS Assistant</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span className="ai-status-dot"></span>
                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 500 }}>Live Activity Feed</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button className="ai-chat-btn-icon" onClick={handleClearChat} title="Reset Chat">
                <RotateCcw size={15} />
              </button>
              <button className="ai-chat-btn-icon" onClick={() => setIsOpen(false)} title="Close Chat">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages Area - AI responses cleanly left-aligned with NO side bot icon */}
          <div className="ai-chat-messages">
            {messages.map((m, idx) => (
              <div key={idx} className={`ai-message-row ${m.sender === 'user' ? 'msg-user' : 'msg-ai'}`}>
                <div className="ai-message-bubble-wrapper">
                  <div className="ai-message-bubble">
                    {m.text === '' && m.isStreaming ? (
                      <div className="loading-dots">
                        <span>.</span><span>.</span><span>.</span>
                      </div>
                    ) : (
                      <FormattedText text={m.text} isStreaming={m.isStreaming} />
                    )}
                  </div>

                  {/* Message Action Toolbar (Copy, Edit for user / Copy, Speak for AI) */}
                  {!m.isStreaming && m.text && (
                    <div className="ai-message-actions">
                      {/* Copy Action */}
                      <button
                        type="button"
                        className="ai-msg-action-btn"
                        onClick={() => handleCopyText(m.text, idx)}
                        title="Copy message text"
                      >
                        {copiedIdx === idx ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      </button>

                      {/* User message: Edit option */}
                      {m.sender === 'user' && (
                        <button
                          type="button"
                          className="ai-msg-action-btn"
                          onClick={() => handleEditMessage(m.text)}
                          title="Edit and retry message"
                        >
                          <Edit3 size={12} />
                        </button>
                      )}

                      {/* AI message: Voice / Text-to-Speech option */}
                      {m.sender === 'ai' && (
                        <button
                          type="button"
                          className={`ai-msg-action-btn ${speakingIdx === idx ? 'speaking' : ''}`}
                          onClick={() => handleSpeakText(m.text, idx)}
                          title={speakingIdx === idx ? "Stop speaking" : "Read aloud (Voice)"}
                        >
                          {speakingIdx === idx ? <VolumeX size={12} color="#ef4444" /> : <Volume2 size={12} />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Prompts */}
          <div className="ai-quick-prompts">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                className="ai-prompt-chip"
                disabled={loading}
                onClick={() => handleSendPrompt(qp.query)}
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* Input Form with Real-Time Voice Assistant Mic Button */}
          <form onSubmit={onSubmit} className="ai-chat-input-form">
            <input
              ref={inputRef}
              type="text"
              placeholder={isListening ? "Listening... speak now" : "Ask about budgets, spent, split debts..."}
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              className={isListening ? "input-listening" : ""}
              required
            />
            {/* Voice Assistant Mic Button */}
            <button
              type="button"
              className={`ai-mic-btn ${isListening ? 'listening' : ''}`}
              onClick={toggleVoiceAssistant}
              title={isListening ? "Stop listening" : "Voice assistant (Speak your query)"}
            >
              {isListening ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
            <button type="submit" className="ai-send-btn" disabled={loading || !input.trim()}>
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
