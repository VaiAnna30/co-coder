import { useState, useRef, useCallback, useEffect } from "react";
import SimplePeer from "@thaunknown/simple-peer";

export function useWebRTC({ roomCode, socket, user }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const peersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const mountedRef = useRef(true);

  // Start media
  const startMedia = useCallback(async () => {
    if (localStreamRef.current) return; // Already started

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (mountedRef.current) {
        setLocalStream(stream);
      }

      // Notify server we're ready for video
      if (socket) {
        socket.emit("video:join", { roomCode });
      }
    } catch (err) {
      console.warn("Could not access media devices:", err.message);
      // Try audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        localStreamRef.current = audioStream;
        if (mountedRef.current) {
          setLocalStream(audioStream);
        }
        if (socket) {
          socket.emit("video:join", { roomCode });
        }
      } catch (audioErr) {
        console.warn("Could not access any media devices:", audioErr.message);
      }
    }
  }, [socket, roomCode]);

  // Stop media
  const stopMedia = useCallback(() => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Destroy all peers
    peersRef.current.forEach((peer) => {
      peer.destroy();
    });
    peersRef.current.clear();
    setRemoteStreams(new Map());

    if (socket) {
      socket.emit("video:leave", { roomCode });
    }
  }, [socket, roomCode]);

  // Create a peer connection
  const createPeer = useCallback(
    (peerId, initiator) => {
      if (peersRef.current.has(peerId)) {
        peersRef.current.get(peerId).destroy();
      }

      const peer = new SimplePeer({
        initiator,
        trickle: true,
        stream: localStreamRef.current || undefined,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      peer.on("signal", (signal) => {
        if (!socket) return;
        if (initiator) {
          socket.emit("video:offer", { roomCode, peerId, signal });
        } else {
          socket.emit("video:answer", { roomCode, peerId, signal });
        }
      });

      peer.on("stream", (remoteStream) => {
        if (mountedRef.current) {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(peerId, remoteStream);
            return next;
          });
        }
      });

      peer.on("close", () => {
        peersRef.current.delete(peerId);
        if (mountedRef.current) {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
        }
      });

      peer.on("error", (err) => {
        console.warn(`Peer ${peerId} error:`, err.message);
        peersRef.current.delete(peerId);
      });

      peersRef.current.set(peerId, peer);
      return peer;
    },
    [socket, roomCode],
  );

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleVideoJoin = ({ peerId }) => {
      if (peerId === user?._id || peerId === user?.id) return;
      // We initiate the offer
      createPeer(peerId, true);
    };

    const handleOffer = ({ targetPeerId, peerId, signal }) => {
      if (
        String(targetPeerId) !== String(user?._id) &&
        String(targetPeerId) !== String(user?.id)
      )
        return;
      let peer = peersRef.current.get(peerId);
      if (!peer) {
        peer = createPeer(peerId, false);
      }
      peer.signal(signal);
    };

    const handleAnswer = ({ targetPeerId, peerId, signal }) => {
      if (
        String(targetPeerId) !== String(user?._id) &&
        String(targetPeerId) !== String(user?.id)
      )
        return;
      const peer = peersRef.current.get(peerId);
      if (peer) {
        peer.signal(signal);
      }
    };

    const handleIceCandidate = ({ targetPeerId, peerId, signal }) => {
      if (
        String(targetPeerId) !== String(user?._id) &&
        String(targetPeerId) !== String(user?.id)
      )
        return;
      const peer = peersRef.current.get(peerId);
      if (peer) {
        peer.signal(signal);
      }
    };

    const handleVideoLeave = ({ peerId }) => {
      const peer = peersRef.current.get(peerId);
      if (peer) {
        peer.destroy();
        peersRef.current.delete(peerId);
      }
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
    };

    socket.on("video:join", handleVideoJoin);
    socket.on("video:offer", handleOffer);
    socket.on("video:answer", handleAnswer);
    socket.on("video:ice-candidate", handleIceCandidate);
    socket.on("video:leave", handleVideoLeave);

    return () => {
      socket.off("video:join", handleVideoJoin);
      socket.off("video:offer", handleOffer);
      socket.off("video:answer", handleAnswer);
      socket.off("video:ice-candidate", handleIceCandidate);
      socket.off("video:leave", handleVideoLeave);
    };
  }, [socket, user, createPeer]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Stop all media
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Destroy all peers
      peersRef.current.forEach((peer) => peer.destroy());
      peersRef.current.clear();
    };
  }, []);

  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
  }, []);

  // Toggle camera
  const toggleCam = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
  }, []);

  return {
    localStream,
    remoteStreams,
    toggleMic,
    toggleCam,
    startMedia,
    stopMedia,
  };
}
