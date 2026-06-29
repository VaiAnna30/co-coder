import { useRef, useEffect, useState, useCallback } from 'react';
import Toolbar from './Toolbar';

export default function Whiteboard({ roomCode, socket }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);
  const startPoint = useRef(null); // For shapes
  const savedImageData = useRef(null); // For shape drag preview

  const [tool, setTool] = useState('pen'); // 'pen' | 'highlighter' | 'eraser' | 'rect' | 'circle' | 'line'
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

      const imageData = ctxRef.current ? ctxRef.current.getImageData(0, 0, canvas.width, canvas.height) : null;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctxRef.current = ctx;

      if (imageData) ctx.putImageData(imageData, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const drawShape = useCallback((ctx, x0, y0, x1, y1, drawColor, width, drawTool) => {
    ctx.beginPath();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = width;

    if (drawTool === 'line') {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    } else if (drawTool === 'rect') {
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
    } else if (drawTool === 'circle') {
      const rx = (x1 - x0) / 2;
      const ry = (y1 - y0) / 2;
      const cx = x0 + rx;
      const cy = y0 + ry;
      ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
    }
    ctx.stroke();
    ctx.closePath();
  }, []);

  const drawLine = useCallback((x0, y0, x1, y1, drawColor, width, drawTool) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (['rect', 'circle', 'line'].includes(drawTool)) {
      drawShape(ctx, x0, y0, x1, y1, drawColor, width, drawTool);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);

    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = width * 4;
    } else if (drawTool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawColor + '55';
      ctx.lineWidth = width * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = width;
    }

    ctx.stroke();
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over';
  }, [drawShape]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;
    
    // Fetch existing strokes when joining
    socket.emit('wb:sync', { roomCode });
    
    const handleDraw = (data) => drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width, data.tool);
    const handleSync = (data) => {
      if (data.strokes && ctxRef.current) {
        ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        data.strokes.forEach((s) => drawLine(s.x0, s.y0, s.x1, s.y1, s.color, s.width, s.tool));
      }
    };
    const handleClear = () => {
      if (ctxRef.current && canvasRef.current) ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    socket.on('wb:update', handleDraw);
    socket.on('wb:sync', handleSync);
    socket.on('wb:clear', handleClear);

    return () => {
      socket.off('wb:update', handleDraw);
      socket.off('wb:sync', handleSync);
      socket.off('wb:clear', handleClear);
    };
  }, [socket, drawLine]);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handlePointerDown = (e) => {
    isDrawing.current = true;
    const coords = getCoords(e);
    startPoint.current = coords;
    lastPoint.current = coords;
    
    if (['rect', 'circle', 'line'].includes(tool) && ctxRef.current && canvasRef.current) {
      savedImageData.current = ctxRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawing.current) return;
    const coords = getCoords(e);

    if (['rect', 'circle', 'line'].includes(tool)) {
      // Shape drawing preview
      if (savedImageData.current && ctxRef.current) {
        ctxRef.current.putImageData(savedImageData.current, 0, 0);
      }
      drawLine(startPoint.current.x, startPoint.current.y, coords.x, coords.y, color, strokeWidth, tool);
    } else {
      // Freehand drawing
      const prev = lastPoint.current;
      drawLine(prev.x, prev.y, coords.x, coords.y, color, strokeWidth, tool);

      if (socket) {
        socket.emit('wb:draw', {
          roomCode,
          stroke: { x0: prev.x, y0: prev.y, x1: coords.x, y1: coords.y, color, width: strokeWidth, tool },
        });
      }
    }
    lastPoint.current = coords;
  };

  const handlePointerUp = (e) => {
    if (!isDrawing.current) return;
    
    if (['rect', 'circle', 'line'].includes(tool) && socket && startPoint.current && lastPoint.current) {
      // Finalize shape and emit
      socket.emit('wb:draw', {
        roomCode,
        stroke: { x0: startPoint.current.x, y0: startPoint.current.y, x1: lastPoint.current.x, y1: lastPoint.current.y, color, width: strokeWidth, tool },
      });
    }
    
    isDrawing.current = false;
    startPoint.current = null;
    lastPoint.current = null;
    savedImageData.current = null;
  };

  const handleClear = () => {
    if (ctxRef.current && canvasRef.current) {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    if (socket) socket.emit('wb:clear', { roomCode });
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
