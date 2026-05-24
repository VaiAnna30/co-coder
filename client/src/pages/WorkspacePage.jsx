import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Layout/Navbar';
import CodeEditor from '../components/Workspace/CodeEditor';
import Whiteboard from '../components/Workspace/Whiteboard';
import ChatPanel from '../components/Workspace/ChatPanel';
import VideoPanel from '../components/Workspace/VideoPanel';
import api from '../utils/api';
import { Code, Palette, MessageSquare, Video } from 'lucide-react';

export default function WorkspacePage() {
  const { roomCode } = useParams();
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'whiteboard'
  const [showChat, setShowChat] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadChat, setUnreadChat] = useState(false);

  // Fetch room data
  useEffect(() => {
    api
      .get(`/rooms/${roomCode}`)
      .then((res) => {
        setRoomData(res.data.room || res.data);
        setLoading(false);
      })
      .catch(() => {
        navigate('/dashboard');
      });
  }, [roomCode, navigate]);

  // Join room via socket
  useEffect(() => {
    if (!socket || !roomData) return;

    socket.emit('room:join', { roomCode });

    // On successful join, receive participant list
    socket.on('room:joined', ({ participants: parts }) => {
      setParticipants(parts || []);
    });

    // When another user joins
    socket.on('room:user-joined', ({ userId, username }) => {
      setParticipants((prev) => {
        if (prev.some((p) => p._id === userId)) return prev;
        return [...prev, { _id: userId, username }];
      });
    });

    // When a user leaves
    socket.on('room:user-left', ({ userId }) => {
      setParticipants((prev) => prev.filter((p) => p._id !== userId));
    });

    return () => {
      socket.emit('room:leave', { roomCode });
      socket.off('room:joined');
      socket.off('room:user-joined');
      socket.off('room:user-left');
    };
  }, [socket, roomData, roomCode]);

  const handleChatToggle = useCallback(() => {
    setShowChat((prev) => !prev);
    if (!showChat) setUnreadChat(false);
  }, [showChat]);

  const handleNewMessage = useCallback(() => {
    if (!showChat) setUnreadChat(true);
  }, [showChat]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span className="loading-text">Joining workspace…</span>
      </div>
    );
  }

  const isAdmin = roomData?.admin?._id === user?._id || roomData?.admin === user?._id;

  return (
    <div className="workspace">
      <Navbar roomCode={roomCode} roomName={roomData?.name} isAdmin={isAdmin} roomId={roomData?._id} />

      <div className="workspace-body">
        {/* Sidebar */}
        <div className="workspace-sidebar">
          <button
            className={`sidebar-tab ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
            title="Code Editor"
          >
            <Code size={20} />
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'whiteboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('whiteboard')}
            title="Whiteboard"
          >
            <Palette size={20} />
          </button>

          <div className="sidebar-divider" />

          <button
            className={`sidebar-tab ${showChat ? 'active' : ''}`}
            onClick={handleChatToggle}
            title="Chat"
          >
            <MessageSquare size={20} />
            {unreadChat && <span className="badge" />}
          </button>
          <button
            className={`sidebar-tab ${showVideo ? 'active' : ''}`}
            onClick={() => setShowVideo((v) => !v)}
            title="Video"
          >
            <Video size={20} />
          </button>

          <div style={{ flex: 1 }} />

          {/* Participants */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            {participants.slice(0, 5).map((p, i) => (
              <div
                key={p._id || p.id || i}
                className={`participant-avatar p${i}`}
                title={p.username || p.name}
              >
                {(p.username || p.name || '?').charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="workspace-main">
          {activeTab === 'code' ? (
            <CodeEditor
              roomCode={roomCode}
              socket={socket}
              language={roomData?.language || 'javascript'}
            />
          ) : (
            <Whiteboard roomCode={roomCode} socket={socket} />
          )}

          {/* Chat Panel (slide-in) */}
          {showChat && (
            <ChatPanel
              roomCode={roomCode}
              socket={socket}
              user={user}
              onClose={() => setShowChat(false)}
              onNewMessage={handleNewMessage}
            />
          )}
        </div>

        {/* Video Panel */}
        <VideoPanel
          roomCode={roomCode}
          socket={socket}
          user={user}
          participants={participants}
          collapsed={!showVideo}
          onToggle={() => setShowVideo((v) => !v)}
        />
      </div>
    </div>
  );
}
