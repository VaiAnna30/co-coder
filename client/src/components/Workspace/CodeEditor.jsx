import { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'plaintext', label: 'Plain Text' },
];

import ExecutionPanel from './ExecutionPanel';

export default function CodeEditor({ roomCode, socket, language: initialLang }) {
  const [language, setLanguage] = useState(initialLang || 'javascript');
  const [code, setCode] = useState('// Start coding collaboratively!\n');
  const isRemoteUpdate = useRef(false);
  const editorRef = useRef(null);
  const debounceTimer = useRef(null);

  // Listen for remote code updates
  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = (data) => {
      isRemoteUpdate.current = true;
      setCode(data.code);
    };

    const handleCodeSync = (data) => {
      isRemoteUpdate.current = true;
      setCode(data.code);
      if (data.language) setLanguage(data.language);
    };

    const handleLanguageChange = (data) => {
      if (data.language) setLanguage(data.language);
    };

    socket.on('code:update', handleCodeUpdate);
    socket.on('code:sync', handleCodeSync);
    socket.on('code:language', handleLanguageChange);

    return () => {
      socket.off('code:update', handleCodeUpdate);
      socket.off('code:sync', handleCodeSync);
      socket.off('code:language', handleLanguageChange);
    };
  }, [socket]);

  const handleEditorChange = useCallback(
    (value) => {
      if (isRemoteUpdate.current) {
        isRemoteUpdate.current = false;
        return;
      }

      setCode(value || '');

      // Debounced emit
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        if (socket) {
          socket.emit('code:change', { roomCode, code: value || '' });
        }
      }, 150);
    },
    [socket, roomCode]
  );

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    if (socket) {
      socket.emit('code:language', { roomCode, language: lang });
    }
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  return (
    <div className="editor-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <select className="language-select" value={language} onChange={handleLanguageChange}>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
            {code.split('\n').length} lines
          </span>
        </div>
        <div className="editor-toolbar-right">
          <span
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--accent-emerald)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent-emerald)',
                display: 'inline-block',
              }}
            />
            Live
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            fontSize: 14,
            fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace",
            fontLigatures: true,
            minimap: { enabled: true, scale: 1 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            padding: { top: 16 },
            renderLineHighlight: 'all',
            bracketPairColorization: { enabled: true },
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 2,
          }}
          loading={
            <div className="flex-center" style={{ height: '100%', background: 'var(--bg-primary)' }}>
              <div className="spinner" />
            </div>
          }
        />
      </div>

      <ExecutionPanel code={code} language={language} />
    </div>
  );
}
