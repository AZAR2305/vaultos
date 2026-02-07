/**
 * Community Chat Monitor - Console-style chat for market events
 * Real-time discussion about active prediction markets
 */
import React, { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: string;
  marketTag?: string;
}

const CommunityChatMonitor: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      username: 'user_a7f3',
      message: 'BTC looking bullish for $100k EOY',
      timestamp: new Date(Date.now() - 120000).toLocaleTimeString(),
      marketTag: 'BTC'
    },
    {
      id: '2',
      username: 'user_9k2m',
      message: 'Just placed 500 shares on YES for ETH 8k',
      timestamp: new Date(Date.now() - 90000).toLocaleTimeString(),
      marketTag: 'ETH'
    },
    {
      id: '3',
      username: 'user_x5p1',
      message: 'anyone analyzing the AGI market? odds seem off',
      timestamp: new Date(Date.now() - 60000).toLocaleTimeString(),
      marketTag: 'AGI'
    },
    {
      id: '4',
      username: 'user_n8w4',
      message: 'Market sentiment shifting, watch for volatility',
      timestamp: new Date(Date.now() - 30000).toLocaleTimeString()
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [username] = useState(`user_${Math.random().toString(36).substring(7)}`);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate incoming messages
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const mockMessages = [
          { msg: 'Volume spike on BTC market!', tag: 'BTC' },
          { msg: 'Odds just shifted 15% on ETH', tag: 'ETH' },
          { msg: 'New whale entered the chat', tag: undefined },
          { msg: 'Anyone else seeing this pump?', tag: undefined },
          { msg: 'Tesla prediction looking interesting', tag: 'TSLA' },
          { msg: 'Settlement incoming for resolved markets', tag: undefined }
        ];
        
        const randomMsg = mockMessages[Math.floor(Math.random() * mockMessages.length)];
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          username: `user_${Math.random().toString(36).substring(2, 6)}`,
          message: randomMsg.msg,
          timestamp: new Date().toLocaleTimeString(),
          marketTag: randomMsg.tag
        };

        setMessages(prev => [...prev, newMessage].slice(-50)); // Keep last 50 messages
      }
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      username,
      message: inputMessage,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="community-chat-monitor">
      <div className="window-frame">
        <div className="window-title">
          {'[ COMMUNITY MONITOR ]'}
          <span className="live-indicator">● LIVE</span>
        </div>

        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className="chat-message">
              <div className="chat-message-header">
                <span className="chat-time">{msg.timestamp}</span>
                <span className="chat-username">{msg.username}</span>
                {msg.marketTag && (
                  <span className="market-tag">[{msg.marketTag}]</span>
                )}
              </div>
              <div className="chat-message-body">
                {'> '}{msg.message}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input-container">
          <div className="input-group" style={{ marginBottom: 0 }}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="> type message..."
              className="input"
              maxLength={200}
            />
          </div>
          <button 
            onClick={sendMessage}
            className="btn-secondary chat-send-btn"
            disabled={!inputMessage.trim()}
          >
            [SEND]
          </button>
        </div>

        <div className="terminal-section" style={{ padding: '8px', background: 'var(--bg-color)', fontSize: '0.7rem' }}>
          <div className="terminal-row">
            <span className="output" style={{ color: 'var(--text-secondary)' }}>
              {'> Real-time community chat • Market discussion • Trade signals'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityChatMonitor;
