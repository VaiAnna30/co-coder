import { useState } from 'react';
import { executeCode } from '../../utils/pistonApi';
import { Play, Terminal, ChevronDown, ChevronUp } from 'lucide-react';

export default function ExecutionPanel({ code, language }) {
  const [stdin, setStdin] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleRun = async () => {
    if (isCollapsed) setIsCollapsed(false);
    setIsRunning(true);
    setOutput('Executing...');
    const result = await executeCode(language, code, stdin);
    setOutput(result.output);
    setIsRunning(false);
  };

  return (
    <div className={`execution-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="execution-header" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setIsCollapsed(!isCollapsed)}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, flex: 1 }}>
          {isCollapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          <Terminal size={16} /> Test Cases & Execution
        </h3>
        <button 
          className="btn btn-primary btn-sm" 
          onClick={(e) => { e.stopPropagation(); handleRun(); }}
          disabled={isRunning}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {isRunning ? <span className="spinner-sm" /> : <Play size={14} />}
          Run Code
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="execution-body">
        <div className="execution-input">
          <label>Input (stdin)</label>
          <textarea 
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Enter test case input here..."
            spellCheck="false"
          />
        </div>
        
        <div className="execution-output">
          <label>Output (stdout)</label>
          <pre className={output.includes('Error') || output.includes('Exception') ? 'error-text' : ''}>
            {output || 'Output will appear here...'}
          </pre>
        </div>
        </div>
      )}
    </div>
  );
}
