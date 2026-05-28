import { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import ExecutionPanel from './ExecutionPanel';
import FileExplorer from './FileExplorer';

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'plaintext', label: 'Plain Text' },
];

const getLanguageFromFileName = (name) => {
  if (name.endsWith('.js')) return 'javascript';
  if (name.endsWith('.py')) return 'python';
  if (name.endsWith('.java')) return 'java';
  if (name.endsWith('.cpp') || name.endsWith('.cc')) return 'cpp';
  if (name.endsWith('.c') || name.endsWith('.h')) return 'c';
  return 'plaintext';
};

export default function CodeEditor({ roomCode, socket, language: initialLang }) {
  const [files, setFiles] = useState([{ id: '1', name: 'main.js', language: initialLang || 'javascript', content: '// Start coding collaboratively!\n' }]);
  const [activeFileId, setActiveFileId] = useState('1');
  const [openFileIds, setOpenFileIds] = useState(['1']); // Array of open tab IDs
  const isRemoteUpdate = useRef(false);
  const editorRef = useRef(null);
  const debounceTimer = useRef(null);

  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  const activeFileIdRef = useRef(activeFileId);
  useEffect(() => {
    activeFileIdRef.current = activeFileId;
  }, [activeFileId]);

  useEffect(() => {
    if (!socket) return;

    socket.on('code:sync', (data) => {
      isRemoteUpdate.current = true;
      if (data.files && data.files.length > 0) {
        setFiles(data.files);
        const firstFile = data.files.find(f => f.type === 'file');
        if (firstFile) {
          setActiveFileId(firstFile.id);
          setOpenFileIds([firstFile.id]);
        } else {
          setActiveFileId(null);
          setOpenFileIds([]);
        }
      } else {
        setFiles([{ id: '1', name: 'main.js', language: data.language || 'javascript', content: data.code || '' }]);
        setOpenFileIds(['1']);
      }
    });

    socket.on('file:change', ({ fileId, content }) => {
      setFiles((prev) => prev.map(f => f.id === fileId ? { ...f, content } : f));
      if (fileId === activeFileIdRef.current) isRemoteUpdate.current = true;
    });

    socket.on('file:create', ({ file }) => {
      setFiles((prev) => [...prev, file]);
    });

    socket.on('file:delete', ({ fileId }) => {
      setFiles((prev) => prev.filter(f => f.id !== fileId));
      setOpenFileIds(prev => {
        const next = prev.filter(id => id !== fileId);
        if (activeFileIdRef.current === fileId) {
          setActiveFileId(next.length > 0 ? next[0] : '1');
        }
        return next;
      });
    });

    socket.on('file:rename', ({ fileId, newName, newLanguage }) => {
      setFiles((prev) => prev.map(f => f.id === fileId ? { ...f, name: newName, language: newLanguage } : f));
    });

    socket.emit('code:sync', { roomCode });

    return () => {
      socket.off('code:sync');
      socket.off('file:change');
      socket.off('file:create');
      socket.off('file:delete');
      socket.off('file:rename');
    };
  }, [socket, roomCode]);

  useEffect(() => {
    if (files.length > 0 && !files.find(f => f.id === activeFileId)) {
      setActiveFileId(files[0].id);
      if (!openFileIds.includes(files[0].id)) setOpenFileIds(prev => [...prev, files[0].id]);
    }
  }, [files, activeFileId, openFileIds]);

  const handleEditorChange = useCallback(
    (value) => {
      if (isRemoteUpdate.current) {
        isRemoteUpdate.current = false;
        return;
      }
      setFiles((prev) => prev.map(f => f.id === activeFileId ? { ...f, content: value || '' } : f));

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        if (socket) {
          socket.emit('file:change', { roomCode, fileId: activeFileId, content: value || '' });
          socket.emit('code:change', { roomCode, code: value || '' });
        }
      }, 150);
    },
    [socket, roomCode, activeFileId]
  );

  const handleCreateFile = (name, type = 'file', parentId = null) => {
    const file = {
      id: crypto.randomUUID(),
      name,
      type,
      parentId,
      language: type === 'file' ? getLanguageFromFileName(name) : 'folder',
      content: ''
    };
    setFiles(prev => [...prev, file]);
    if (type === 'file') {
      setActiveFileId(file.id);
      setOpenFileIds(prev => [...prev, file.id]);
    }
    socket.emit('file:create', { roomCode, file });
  };

  const handleDeleteFile = (id) => {
    const idsToDelete = new Set([id]);
    const collectChildren = (parentId) => {
      files.forEach(f => {
        if (f.parentId === parentId && !idsToDelete.has(f.id)) {
          idsToDelete.add(f.id);
          if (f.type === 'folder') collectChildren(f.id);
        }
      });
    };
    collectChildren(id);

    const remainingFiles = files.filter(f => !idsToDelete.has(f.id));

    setFiles(remainingFiles);
    
    setOpenFileIds(prev => {
      const next = prev.filter(tabId => !idsToDelete.has(tabId));
      if (idsToDelete.has(activeFileId)) {
        const fallbackFile = remainingFiles.find(f => f.type === 'file');
        setActiveFileId(fallbackFile ? fallbackFile.id : null);
      }
      return next;
    });

    idsToDelete.forEach(deleteId => {
      socket.emit('file:delete', { roomCode, fileId: deleteId });
    });
  };

  const handleRenameFile = (id, newName) => {
    const file = files.find(f => f.id === id);
    if (!file) return;
    const newLanguage = file.type === 'file' ? getLanguageFromFileName(newName) : 'folder';
    setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName, language: newLanguage } : f));
    socket.emit('file:rename', { roomCode, fileId: id, newName, newLanguage });
  };

  const handleLanguageChange = (e) => {
    if (!activeFile) return;
    const lang = e.target.value;
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, language: lang } : f));
    socket.emit('file:rename', { roomCode, fileId: activeFileId, newName: activeFile.name, newLanguage: lang });
    socket.emit('code:language', { roomCode, language: lang });
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const handleSelectFile = (id) => {
    setActiveFileId(id);
    if (!openFileIds.includes(id)) {
      setOpenFileIds(prev => [...prev, id]);
    }
  };

  const handleCloseTab = (e, id) => {
    e.stopPropagation();
    setOpenFileIds(prev => {
      const next = prev.filter(tabId => tabId !== id);
      if (next.length === 0) {
        setActiveFileId(null);
        return next;
      }
      if (activeFileId === id) {
        setActiveFileId(next[next.length - 1]);
      }
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <FileExplorer 
        files={files}
        activeFileId={activeFileId}
        onSelectFile={handleSelectFile}
        onCreateFile={handleCreateFile}
        onDeleteFile={handleDeleteFile}
        onRenameFile={handleRenameFile}
      />
      
      <div className="editor-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', background: 'var(--bg-primary)' }}>
        {/* VS Code Style Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', minHeight: '35px' }}>
          {openFileIds.map(id => {
            const f = files.find(file => file.id === id);
            if (!f) return null;
            const isActive = id === activeFileId;
            return (
              <div 
                key={id}
                onClick={() => setActiveFileId(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                  background: isActive ? 'var(--bg-primary)' : 'transparent',
                  borderTop: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  borderRight: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)', minWidth: '120px'
                }}
              >
                <span style={{ flex: 1, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{f.name}</span>
                <span 
                  onClick={(e) => handleCloseTab(e, id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '4px', cursor: 'pointer', color: 'inherit' }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  ×
                </span>
              </div>
            );
          })}
        </div>

        {!activeFile ? (
          <div className="flex-center" style={{ flex: 1, flexDirection: 'column', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2 }}>📄</div>
            <h3>No File Selected</h3>
            <p style={{ fontSize: 'var(--fs-sm)' }}>Select a file from the explorer or create a new one to start coding.</p>
          </div>
        ) : (
          <>
            <div className="editor-toolbar">
              <div className="editor-toolbar-left" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{activeFile.name}</span>
                <select className="language-select" value={activeFile.language} onChange={handleLanguageChange}>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="editor-toolbar-right">
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }} />
                  Live
                </span>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              <Editor
                height="100%"
                language={activeFile.language}
                value={activeFile.content}
                path={activeFile.id}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace",
                  minimap: { enabled: true, scale: 1 },
                  automaticLayout: true,
                  wordWrap: 'on',
                  tabSize: 2,
                }}
                loading={<div className="flex-center" style={{ height: '100%', background: 'var(--bg-primary)' }}><div className="spinner" /></div>}
              />
            </div>

            <ExecutionPanel code={activeFile.content} language={activeFile.language} />
          </>
        )}
      </div>
    </div>
  );
}
