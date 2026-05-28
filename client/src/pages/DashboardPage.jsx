import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Navbar from '../components/Layout/Navbar';
import api from '../utils/api';
import { Rocket, Link as LinkIcon, FolderOpen, Inbox, Users, Clock, Trash2, DoorOpen, Plus } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await api.get('/rooms');
      setRooms(res.data.rooms || res.data || []);
    } catch {
      showToast('error', 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Listen for real-time admission
  useEffect(() => {
    if (!socket) return;
    const handleAdmitted = ({ roomCode }) => {
      showToast('success', 'You were admitted! Joining room...');
      setTimeout(() => navigate(`/workspace/${roomCode}`), 1000);
    };
    socket.on('room:admitted', handleAdmitted);
    return () => socket.off('room:admitted', handleAdmitted);
  }, [socket, navigate, showToast]);

  // Extract pending approvals from rooms where user is admin
  useEffect(() => {
    const approvals = [];
    rooms.forEach((room) => {
      const isAdmin = room.admin?._id === user?._id || room.admin === user?._id;
      if (isAdmin && room.pendingApprovals?.length > 0) {
        room.pendingApprovals.forEach((p) => {
          approvals.push({
            roomId: room._id,
            roomCode: room.roomCode,
            roomName: room.name,
            userId: p._id || p,
            username: p.username || 'Unknown',
          });
        });
      }
    });
    setPendingApprovals(approvals);
  }, [rooms, user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/rooms/create', { name: newRoomName.trim() });
      const room = res.data.room || res.data;
      showToast('success', `Room "${room.name}" created!`);
      setShowCreateModal(false);
      setNewRoomName('');
      fetchRooms();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const res = await api.post('/rooms/join', { roomCode: joinCode.trim() });
      if (res.data.message === 'Already a participant') {
        navigate(`/workspace/${joinCode.trim()}`);
      } else {
        showToast('success', 'Join request sent!');
        if (socket) {
          socket.emit('room:request-join', { roomCode: joinCode.trim() });
        }
      }
      setJoinCode('');
      fetchRooms();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to join room';
      showToast('error', msg);
    } finally {
      setJoining(false);
    }
  };

  const handleApprove = async (roomId, roomCode, userId, approve) => {
    try {
      await api.post(`/rooms/approve/${roomId}`, {
        userId,
        action: approve ? 'approve' : 'reject',
      });
      showToast('success', approve ? 'User approved!' : 'User rejected.');
      if (approve && socket) {
        socket.emit('room:admit-user', { roomCode, userId });
      }
      setPendingApprovals((prev) => prev.filter((p) => !(p.roomId === roomId && p.userId === userId)));
      fetchRooms();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Action failed');
    }
  };

  const openRoom = (roomCode) => {
    navigate(`/workspace/${roomCode}`);
  };

  const handleLeaveOrDelete = async (e, roomId, isAdmin) => {
    e.stopPropagation();
    try {
      if (isAdmin) {
        if (window.confirm('Are you sure you want to permanently delete this room?')) {
          await api.delete(`/rooms/${roomId}`);
          showToast('success', 'Room deleted');
          fetchRooms();
        }
      } else {
        if (window.confirm('Are you sure you want to leave this room?')) {
          await api.post(`/rooms/leave/${roomId}`);
          showToast('success', 'Left room');
          fetchRooms();
        }
      }
    } catch (error) {
      showToast('error', 'Action failed');
    }
  };

  return (
    <>
      <Navbar />
      <div className="bg-pattern" />

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => setToast(null)}>×</button>
          </div>
        </div>
      )}

      <div className="dashboard-page" style={{ position: 'relative', zIndex: 1 }}>
        <div className="dashboard-header">
          <h1>Welcome back, {user?.username}</h1>
          <p>Manage your collaborative workspaces</p>
        </div>

        <div className="dashboard-actions">
          {/* Create Room Card */}
          <div className="card card-interactive action-card">
            <h3>
              <span className="action-icon"><Rocket size={24} color="var(--accent-blue)" /></span>
              Create Room
            </h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
              Start a new collaborative workspace
            </p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> New Room
            </button>
          </div>

          {/* Join Room Card */}
          <div className="card card-interactive action-card">
            <h3>
              <span className="action-icon"><LinkIcon size={24} color="var(--accent-cyan)" /></span>
              Join Room
            </h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
              Enter a room code to join a workspace
            </p>
            <form className="join-form" onSubmit={handleJoin}>
              <input
                type="text"
                className="input"
                placeholder="Enter room code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary" disabled={joining || !joinCode.trim()}>
                {joining ? <span className="spinner spinner-sm" /> : 'Join'}
              </button>
            </form>
          </div>
        </div>

        {/* Rooms Grid */}
        <div className="rooms-section">
          <h2><FolderOpen size={24} style={{ marginRight: '8px' }} /> Your Rooms</h2>

          {loading ? (
            <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
              <div className="spinner" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Inbox size={48} color="var(--text-muted)" /></div>
              <h3>No rooms yet</h3>
              <p>Create your first room or join one with a code!</p>
            </div>
          ) : (
            <div className="rooms-grid">
              {rooms.map((room) => {
                const isAdmin = room.admin?._id === user?._id || room.admin === user?._id;
                return (
                  <div
                    key={room._id || room.roomCode}
                    className="card card-interactive room-card"
                    onClick={() => openRoom(room.roomCode)}
                  >
                    <div className="room-card-header">
                      <h3>{room.name}</h3>
                      <span className="room-card-code">{room.roomCode}</span>
                    </div>
                    <div className="room-card-meta">
                      <span>
                        <Users size={16} style={{ marginRight: '4px' }} />{' '}
                        {room.participants?.length || room.memberCount || 0}/5
                      </span>
                      <div className="participants-dots">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={`dot ${i < (room.participants?.length || room.memberCount || 0) ? '' : 'empty'}`}
                          />
                        ))}
                      </div>
                      <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                        {room.language || 'javascript'}
                      </span>
                      <button
                        className={`btn btn-sm btn-icon ${isAdmin ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={(e) => handleLeaveOrDelete(e, room._id, isAdmin)}
                        title={isAdmin ? 'Delete Room' : 'Leave Room'}
                        style={{ marginLeft: '12px' }}
                      >
                        {isAdmin ? <Trash2 size={16} /> : <DoorOpen size={16} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending approvals */}
        {pendingApprovals.length > 0 && (
          <div className="pending-section">
            <h2><Clock size={24} style={{ marginRight: '8px' }} /> Pending Approvals</h2>
            {pendingApprovals.map((p, i) => (
              <div className="pending-item" key={i}>
                <div className="pending-info">
                  <div className="user-avatar">{p.username?.charAt(0) || '?'}</div>
                  <div>
                    <strong>{p.username}</strong> wants to join{' '}
                    <strong>{p.roomName}</strong>
                  </div>
                </div>
                <div className="pending-actions">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleApprove(p.roomId, p.userId, true)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleApprove(p.roomId, p.userId, false)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Room</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>
            <form className="modal-body" onSubmit={handleCreate}>
              <div className="input-group">
                <label>Room Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="My Awesome Project"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !newRoomName.trim()}
                >
                  {creating ? <span className="spinner spinner-sm" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
