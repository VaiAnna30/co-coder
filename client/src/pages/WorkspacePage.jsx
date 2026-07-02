import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Layout/Navbar";
import CodeEditor from "../components/Workspace/CodeEditor";
import Whiteboard from "../components/Workspace/Whiteboard";
import ChatPanel from "../components/Workspace/ChatPanel";
import VideoPanel from "../components/Workspace/VideoPanel";
import api from "../utils/api";
import { Code, Palette, MessageSquare, Video } from "lucide-react";

export default function WorkspacePage() {
  const { roomCode } = useParams();
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("code"); // 'code' | 'whiteboard'
  const [showChat, setShowChat] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadChat, setUnreadChat] = useState(false);

  // Real-time admin admissions
  const [joinRequests, setJoinRequests] = useState([]);

  // Fetch room data
  useEffect(() => {
    api
      .get(`/rooms/${roomCode}`)
      .then((res) => {
        setRoomData(res.data.room || res.data);
        setLoading(false);
      })
      .catch(() => {
        navigate("/dashboard");
      });
  }, [roomCode, navigate]);

  const isAdmin =
    roomData?.admin?._id === user?._id || roomData?.admin === user?._id;

  // Join room via socket
  useEffect(() => {
    if (!socket || !roomData) return;

    socket.emit("room:join", { roomCode });

    // On successful join, receive participant list
    socket.on("room:joined", ({ participants: parts }) => {
      setParticipants(parts || []);
    });

    // When another user joins
    socket.on("room:user-joined", ({ userId, username }) => {
      setParticipants((prev) => {
        if (prev.some((p) => p._id === userId)) return prev;
        return [...prev, { _id: userId, username }];
      });
    });

    // When a user leaves
    socket.on("room:user-left", ({ userId }) => {
      setParticipants((prev) => prev.filter((p) => p._id !== userId));
    });

    const handleJoinRequest = ({ userId, username }) => {
      if (isAdmin) {
        setJoinRequests((prev) => {
          if (prev.some((r) => r.userId === userId)) return prev;
          return [...prev, { userId, username }];
        });
      }
    };
    socket.on("room:join-request", handleJoinRequest);

    const handleKicked = ({ roomCode: kickedRoom }) => {
      if (kickedRoom === roomCode) {
        alert("You have been kicked from the room by the admin.");
        navigate("/dashboard");
      }
    };
    socket.on("room:kicked", handleKicked);

    return () => {
      socket.emit("room:leave", { roomCode });
      socket.off("room:joined");
      socket.off("room:user-joined");
      socket.off("room:user-left");
      socket.off("room:join-request", handleJoinRequest);
      socket.off("room:kicked", handleKicked);
    };
  }, [socket, roomData, roomCode, isAdmin, navigate]);

  const handleAdminApprove = async (userId, approve) => {
    try {
      await api.post(`/rooms/approve/${roomData._id}`, {
        userId,
        action: approve ? "approve" : "reject",
      });
      if (approve && socket) {
        socket.emit("room:admit-user", { roomCode, userId });
      }
      setJoinRequests((prev) => prev.filter((r) => r.userId !== userId));
    } catch (err) {
      console.error("Action failed");
    }
  };

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

  return (
    <div className="workspace" style={{ position: "relative" }}>
      <Navbar
        roomCode={roomCode}
        roomName={roomData?.name}
        isAdmin={isAdmin}
        roomId={roomData?._id}
      />

      {/* Join Requests Toast (Admin) */}
      {isAdmin && joinRequests.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "70px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {joinRequests.map((req) => (
            <div
              key={req.userId}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--accent-blue)",
                padding: "12px 20px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
              }}
            >
              <span style={{ color: "white" }}>
                <strong>{req.username}</strong> wants to join
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => handleAdminApprove(req.userId, true)}
                  style={{
                    background: "var(--accent-emerald)",
                    color: "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Admit
                </button>
                <button
                  onClick={() => handleAdminApprove(req.userId, false)}
                  style={{
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "1px solid var(--text-muted)",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="workspace-body">
        {/* Sidebar */}
        <div className="workspace-sidebar">
          <button
            className={`sidebar-tab ${activeTab === "code" ? "active" : ""}`}
            onClick={() => setActiveTab("code")}
            title="Code Editor"
          >
            <Code size={20} />
          </button>
          <button
            className={`sidebar-tab ${activeTab === "whiteboard" ? "active" : ""}`}
            onClick={() => setActiveTab("whiteboard")}
            title="Whiteboard"
          >
            <Palette size={20} />
          </button>

          <div className="sidebar-divider" />

          <button
            className={`sidebar-tab ${showChat ? "active" : ""}`}
            onClick={handleChatToggle}
            title="Chat"
          >
            <MessageSquare size={20} />
            {unreadChat && <span className="badge" />}
          </button>
          <button
            className={`sidebar-tab ${showVideo ? "active" : ""}`}
            onClick={() => setShowVideo((v) => !v)}
            title="Video"
          >
            <Video size={20} />
          </button>

          <div style={{ flex: 1 }} />

          {/* Participants */}
          <div className="participants-wrapper">
            {participants.slice(0, 5).map((p, i) => (
              <div
                key={p._id || p.id || i}
                className={`participant-avatar p${i}`}
                title={p.username || p.name}
                style={{
                  position: "relative",
                  cursor: isAdmin && p._id !== user._id ? "pointer" : "default",
                }}
                onMouseOver={(e) => {
                  if (isAdmin && p._id !== user._id) {
                    const kickBtn = e.currentTarget.querySelector(".kick-btn");
                    if (kickBtn) kickBtn.style.opacity = 1;
                  }
                }}
                onMouseOut={(e) => {
                  const kickBtn = e.currentTarget.querySelector(".kick-btn");
                  if (kickBtn) kickBtn.style.opacity = 0;
                }}
              >
                {(p.username || p.name || "?").charAt(0).toUpperCase()}
                {isAdmin && p._id !== user._id && (
                  <div
                    className="kick-btn"
                    onClick={() =>
                      socket.emit("room:kick", {
                        roomCode,
                        targetUserId: p._id,
                      })
                    }
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: "rgba(255,0,0,0.8)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      opacity: 0,
                      transition: "opacity 0.2s",
                      fontSize: "12px",
                    }}
                    title={`Kick ${p.username || p.name}`}
                  >
                    ×
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="workspace-main">
          {activeTab === "code" ? (
            <CodeEditor
              roomCode={roomCode}
              socket={socket}
              language={roomData?.language || "javascript"}
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
