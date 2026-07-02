import { useState, useRef, useEffect, useCallback } from "react";
import { useWebRTC } from "../../hooks/useWebRTC";
import { Video, Mic, MicOff, Camera, CameraOff, X } from "lucide-react";

export default function VideoPanel({
  roomCode,
  socket,
  user,
  participants,
  collapsed,
  onToggle,
}) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const localVideoRef = useRef(null);
  const dragRef = useRef(null);
  const handleRef = useRef(null);

  // Drag logic
  useEffect(() => {
    const el = dragRef.current;
    const handle = handleRef.current;
    if (!el || !handle) return;

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    const onMouseDown = (e) => {
      // Don't drag if clicking buttons
      if (e.target.closest("button")) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.left = initialLeft + "px";
      el.style.top = initialTop + "px";
      el.style.transition = "none";

      document.body.style.userSelect = "none";
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = initialLeft + dx + "px";
      el.style.top = initialTop + dy + "px";
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = "";
        el.style.transition = "";
      }
    };

    handle.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      handle.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const {
    localStream,
    remoteStreams,
    toggleMic,
    toggleCam,
    startMedia,
    stopMedia,
  } = useWebRTC({
    roomCode,
    socket,
    user,
  });

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Start media when panel is visible
  useEffect(() => {
    if (!collapsed) {
      startMedia();
    } else {
      stopMedia();
    }
  }, [collapsed, startMedia, stopMedia]);

  const handleToggleMic = useCallback(() => {
    toggleMic();
    setMicOn((prev) => !prev);
  }, [toggleMic]);

  const handleToggleCam = useCallback(() => {
    toggleCam();
    setCamOn((prev) => !prev);
  }, [toggleCam]);

  const initial = user?.username ? user.username.charAt(0).toUpperCase() : "?";

  return (
    <div
      ref={dragRef}
      className={`video-panel ${collapsed ? "collapsed" : ""}`}
    >
      {!collapsed && (
        <>
          <div
            ref={handleRef}
            className="video-panel-header"
            style={{ cursor: "grab" }}
          >
            <h3
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: 0,
              }}
            >
              <Video size={18} /> Video
            </h3>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={onToggle}
              title="Collapse video"
            >
              <X size={16} />
            </button>
          </div>

          <div className="video-grid">
            {/* Local video */}
            <div className="video-tile">
              {localStream && camOn ? (
                <video ref={localVideoRef} autoPlay muted playsInline />
              ) : (
                <div className="no-video-placeholder">
                  <div className="avatar-lg">{initial}</div>
                  <span
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {camOn ? "Loading..." : "Camera off"}
                  </span>
                </div>
              )}
              <span className="video-label">You</span>
            </div>

            {/* Remote videos */}
            {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
              const participant = participants.find(
                (p) => (p._id || p.id) === peerId,
              );
              const name = participant?.username || participant?.name || "Peer";
              return <RemoteVideo key={peerId} stream={stream} name={name} />;
            })}
          </div>

          <div className="video-controls">
            <button
              className={`btn btn-secondary btn-icon ${!micOn ? "active" : ""}`}
              onClick={handleToggleMic}
              title={micOn ? "Mute mic" : "Unmute mic"}
            >
              {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <button
              className={`btn btn-secondary btn-icon ${!camOn ? "active" : ""}`}
              onClick={handleToggleCam}
              title={camOn ? "Turn off camera" : "Turn on camera"}
            >
              {camOn ? <Camera size={18} /> : <CameraOff size={18} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function RemoteVideo({ stream, name }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;

      // Explicitly call play to ensure audio/video starts even under strict autoplay policies
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn(`Autoplay prevented for ${name}'s stream:`, error);
        });
      }
    }
  }, [stream, name]);

  const initial = name ? name.charAt(0).toUpperCase() : "?";

  return (
    <div className="video-tile">
      {stream ? (
        <video ref={videoRef} autoPlay playsInline />
      ) : (
        <div className="no-video-placeholder">
          <div className="avatar-lg">{initial}</div>
        </div>
      )}
      <span className="video-label">{name}</span>
    </div>
  );
}
