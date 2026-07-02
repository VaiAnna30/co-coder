import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { Link, LogOut, Trash2, DoorOpen } from "lucide-react";

export default function Navbar({ roomCode, roomName, isAdmin, roomId }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
    }
  };

  const handleLeaveOrDelete = async () => {
    if (!roomId) return;
    try {
      if (isAdmin) {
        if (
          window.confirm(
            "Are you sure you want to permanently delete this room?",
          )
        ) {
          await api.delete(`/rooms/${roomId}`);
          navigate("/dashboard");
        }
      } else {
        if (window.confirm("Are you sure you want to leave this room?")) {
          await api.post(`/rooms/leave/${roomId}`);
          navigate("/dashboard");
        }
      }
    } catch (error) {
      console.error("Failed to leave/delete room:", error);
      alert("Action failed. Please try again.");
    }
  };

  const initial = user?.username ? user.username.charAt(0).toUpperCase() : "?";

  return (
    <nav className="navbar">
      <div
        className="navbar-brand"
        style={{ cursor: "pointer" }}
        onClick={() => navigate("/dashboard")}
      >
        <span className="logo-icon">⟨/⟩</span>
        <span className="brand-text">CoCode</span>
      </div>

      <div className="navbar-center">
        {roomCode && (
          <>
            {roomName && (
              <span
                style={{
                  fontSize: "var(--fs-sm)",
                  color: "var(--text-secondary)",
                }}
              >
                {roomName}
              </span>
            )}
            <button
              className="room-code-badge"
              onClick={handleCopyCode}
              title="Click to copy room code"
            >
              <Link size={12} /> {roomCode}
            </button>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "var(--fs-xs)",
                color: connected
                  ? "var(--accent-emerald)"
                  : "var(--text-muted)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: connected
                    ? "var(--accent-emerald)"
                    : "var(--text-muted)",
                  boxShadow: connected
                    ? "0 0 6px var(--accent-emerald-glow)"
                    : "none",
                }}
              />
              {connected ? "Connected" : "Disconnected"}
            </span>
          </>
        )}
      </div>

      <div className="navbar-right">
        {roomCode && (
          <button
            className={`btn btn-sm ${isAdmin ? "btn-danger" : "btn-secondary"}`}
            onClick={handleLeaveOrDelete}
            style={{ marginRight: "1rem" }}
          >
            {isAdmin ? <Trash2 size={16} /> : <DoorOpen size={16} />}
            <span>{isAdmin ? "Delete Room" : "Leave Room"}</span>
          </button>
        )}
        <div className="user-info">
          <div className="user-avatar">{initial}</div>
          <span>{user?.username}</span>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}
