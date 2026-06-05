import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import api from '../api';
import './AIChatWidget.css';

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'ai', text: "Hi! I'm FinanceOS Assistant. How can I help you analyze your transactions, budgets, or savings goals today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message: userMsg });
      setMessages(prev => [...prev, { sender: 'ai', text: res.data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'ai', text: "Sorry, I'm having trouble processing that right now." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-chat-container">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button className="ai-chat-toggle" onClick={() => setIsOpen(true)} title="Ask AI">
          <Sparkles className="sparkle-icon" size={20} />
          <span>Ask AI</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="ai-chat-window glass-panel animate-slide-up">
          {/* Header */}
          <div className="ai-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="ai-avatar"><Bot size={18} /></div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>FinanceOS Assistant</h4>
                <span style={{ fontSize: '0.7rem', color: '#10b981' }}>● Online</span>
              </div>
            </div>
            <button className="ai-chat-close" onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="ai-chat-messages">
            {messages.map((m, idx) => (
              <div key={idx} className={`ai-message-row ${m.sender === 'user' ? 'msg-user' : 'msg-ai'}`}>
                {m.sender === 'ai' && (
                  <div className="ai-message-avatar"><Bot size={14} /></div>
                )}
                <div className="ai-message-bubble">
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-message-row msg-ai">
                <div className="ai-message-avatar"><Bot size={14} /></div>
                <div className="ai-message-bubble loading-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="ai-chat-input-form">
            <input
              type="text"
              placeholder="Ask about budgets, goals, spent..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              required
            />
            <button type="submit" className="ai-send-btn" disabled={loading}>
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
