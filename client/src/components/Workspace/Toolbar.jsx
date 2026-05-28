import { PenTool, Highlighter, Eraser, Trash2, Square, Circle, Minus } from 'lucide-react';

export default function Toolbar({ tool, setTool, color, setColor, strokeWidth, setStrokeWidth, onClear }) {
  return (
    <div className="wb-toolbar">
      <button
        className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
        onClick={() => setTool('pen')}
        title="Pen"
      >
        <PenTool size={18} />
      </button>
      <button
        className={`tool-btn ${tool === 'highlighter' ? 'active' : ''}`}
        onClick={() => setTool('highlighter')}
        title="Highlighter"
      >
        <Highlighter size={18} />
      </button>
      
      <div className="toolbar-divider" />
      
      <button
        className={`tool-btn ${tool === 'rect' ? 'active' : ''}`}
        onClick={() => setTool('rect')}
        title="Rectangle"
      >
        <Square size={18} />
      </button>
      <button
        className={`tool-btn ${tool === 'circle' ? 'active' : ''}`}
        onClick={() => setTool('circle')}
        title="Circle"
      >
        <Circle size={18} />
      </button>
      <button
        className={`tool-btn ${tool === 'line' ? 'active' : ''}`}
        onClick={() => setTool('line')}
        title="Line"
      >
        <Minus size={18} />
      </button>

      <div className="toolbar-divider" />

      <button
        className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
        onClick={() => setTool('eraser')}
        title="Eraser"
      >
        <Eraser size={18} />
      </button>

      <div className="toolbar-divider" />

      <input
        type="color"
        className="color-picker-input"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        title="Pick color"
      />

      <div className="toolbar-divider" />

      <input
        type="range"
        className="stroke-slider"
        min="1"
        max="20"
        value={strokeWidth}
        onChange={(e) => setStrokeWidth(Number(e.target.value))}
        title={`Stroke: ${strokeWidth}px`}
      />
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', minWidth: '24px' }}>
        {strokeWidth}px
      </span>

      <div className="toolbar-divider" />

      <button className="tool-btn" onClick={onClear} title="Clear canvas">
        <Trash2 size={18} />
      </button>
    </div>
  );
}
