import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';

export default function ChatPanel({ roomCode, socket, user, onClose, onNewMessage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [closing, setClosing] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (msg) => {
      setMessages((prev) => [...prev, msg]);
      onNewMessage?.();
    };

    const handleHistory = ({ messages: history }) => {
      setMessages(history || []);
    };

    socket.on('chat:receive', handleReceive);
    socket.on('chat:history', handleHistory);

    // Request chat history
    socket.emit('chat:history', { roomCode });

    return () => {
      socket.off('chat:receive', handleReceive);
      socket.off('chat:history', handleHistory);
    };
  }, [socket, roomCode, onNewMessage]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    socket.emit('chat:send', {
      roomCode,
      message: input.trim(),
    });

    setInput('');
  };

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      onClose();
    }, 280);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`chat-panel ${closing ? 'closing' : ''}`}>
      <div className="chat-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} /> Chat
        </h3>
        <button className="btn btn-ghost btn-icon" onClick={handleClose} title="Close chat">
          <X size={16} />
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              padding: 'var(--space-8)',
              fontSize: 'var(--fs-sm)',
            }}
          >
            <div style={{ marginBottom: 'var(--space-2)' }}><MessageSquare size={32} /></div>
            No messages yet. Say hello!
          </div>
        )}

        {messages.map((msg, i) => {
          const isOwn =
            String(msg.sender) === String(user?._id) ||
            msg.senderName === user?.username;
          return (
            <div key={msg._id || i} className={`chat-message ${isOwn ? 'own' : ''}`}>
              <div className="chat-message-header">
                <span className="chat-message-sender">
                  {isOwn ? 'You' : msg.senderName || 'Unknown'}
                </span>
                <span className="chat-message-time">{formatTime(msg.timestamp)}</span>
              </div>
              <div className="chat-message-body">{msg.message}</div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSend}>
        <input
          type="text"
          className="input"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
        <button
          type="submit"
          className="btn btn-primary btn-icon"
          disabled={!input.trim()}
          title="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
