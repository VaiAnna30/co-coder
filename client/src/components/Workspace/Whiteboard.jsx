import { useRef, useEffect, useState, useCallback } from 'react';
import Toolbar from './Toolbar';

export default function Whiteboard({ roomCode, socket }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);

  const [tool, setTool] = useState('pen');       // 'pen' | 'highlighter' | 'eraser'
  const [color, setColor] = useState('#3b82f6');
  const [strokeWidth, setStrokeWidth] = useState(3);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();

      // Save existing image data
      const imageData = ctxRef.current
        ? ctxRef.current.getImageData(0, 0, canvas.width, canvas.height)
        : null;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctxRef.current = ctx;

      // Restore image data
      if (imageData) {
        ctx.putImageData(imageData, 0, 0);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleDraw = (data) => {
      drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width, data.tool);
    };

    const handleSync = (data) => {
      if (data.strokes && ctxRef.current) {
        ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        data.strokes.forEach((s) => {
          drawLine(s.x0, s.y0, s.x1, s.y1, s.color, s.width, s.tool);
        });
      }
    };

    const handleClear = () => {
      if (ctxRef.current && canvasRef.current) {
        ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };

    socket.on('wb:update', handleDraw);
    socket.on('wb:sync', handleSync);
    socket.on('wb:clear', handleClear);

    return () => {
      socket.off('wb:update', handleDraw);
      socket.off('wb:sync', handleSync);
      socket.off('wb:clear', handleClear);
    };
  }, [socket]);

  const drawLine = useCallback((x0, y0, x1, y1, drawColor, width, drawTool) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);

    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = width * 4;
    } else if (drawTool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawColor + '55'; // semi-transparent
      ctx.lineWidth = width * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = width;
    }

    ctx.stroke();
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over';
  }, []);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handlePointerDown = (e) => {
    isDrawing.current = true;
    const coords = getCoords(e);
    lastPoint.current = coords;
  };

  const handlePointerMove = (e) => {
    if (!isDrawing.current) return;
    const coords = getCoords(e);
    const prev = lastPoint.current;

    drawLine(prev.x, prev.y, coords.x, coords.y, color, strokeWidth, tool);

    if (socket) {
      socket.emit('wb:draw', {
        roomCode,
        stroke: {
          x0: prev.x,
          y0: prev.y,
          x1: coords.x,
          y1: coords.y,
          color,
          width: strokeWidth,
          tool,
        },
      });
    }

    lastPoint.current = coords;
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    lastPoint.current = null;
  };

  const handleClear = () => {
    if (ctxRef.current && canvasRef.current) {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    if (socket) {
      socket.emit('wb:clear', { roomCode });
    }
  };

  return (
    <div className="whiteboard-container">
      <canvas
        ref={canvasRef}
        className="whiteboard-canvas"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />
      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        onClear={handleClear}
      />
    </div>
  );
}
