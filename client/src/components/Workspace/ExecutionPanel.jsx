import { useState } from 'react';
import { executeCode } from '../../utils/pistonApi';
import { Play, Terminal } from 'lucide-react';

export default function ExecutionPanel({ code, language }) {
  const [stdin, setStdin] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Executing...');
    const result = await executeCode(language, code, stdin);
    setOutput(result.output);
    setIsRunning(false);
  };

  return (
    <div className="execution-panel">
      <div className="execution-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Terminal size={16} /> Test Cases & Execution
        </h3>
        <button 
          className="btn btn-primary btn-sm" 
          onClick={handleRun}
          disabled={isRunning}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {isRunning ? <span className="spinner-sm" /> : <Play size={14} />}
          Run Code
        </button>
      </div>
      
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
    </div>
  );
}
