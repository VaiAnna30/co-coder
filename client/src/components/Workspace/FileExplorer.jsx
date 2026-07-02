import { useState } from "react";
import {
  File,
  Folder,
  FolderOpen,
  Trash2,
  Edit2,
  X,
  Check,
  DownloadCloud,
  FilePlus,
  FolderPlus,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const FileTreeItem = ({
  file,
  files,
  level,
  activeFileId,
  expandedFolders,
  toggleFolder,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
  creatingState,
  setCreatingState,
  handleCreate,
  editingId,
  editName,
  setEditName,
  handleRename,
  setEditingId,
}) => {
  const isFolder = file.type === "folder";
  const isExpanded = expandedFolders.has(file.id);
  const children = files.filter((f) => f.parentId === file.id);

  const sortedChildren = children.sort((a, b) => {
    if (a.type === "folder" && b.type === "file") return -1;
    if (a.type === "file" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      style={{
        marginLeft: level === 0 ? "0px" : "12px",
        borderLeft: level > 0 ? "1px solid rgba(255,255,255,0.1)" : "none",
      }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (isFolder) {
            toggleFolder(file.id);
          } else {
            onSelectFile(file.id);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "4px 8px",
          cursor: "pointer",
          background:
            activeFileId === file.id ? "var(--bg-primary)" : "transparent",
          color:
            activeFileId === file.id
              ? "var(--text-primary)"
              : "var(--text-secondary)",
        }}
        className="file-tree-row"
      >
        <div style={{ marginRight: "6px", flexShrink: 0, display: "flex" }}>
          {isFolder ? (
            isExpanded ? (
              <FolderOpen size={16} color="var(--accent-blue)" />
            ) : (
              <Folder size={16} color="var(--accent-blue)" />
            )
          ) : (
            <File size={16} />
          )}
        </div>

        {editingId === file.id ? (
          <input
            autoFocus
            style={{
              flex: 1,
              minWidth: 0,
              background: "var(--bg-primary)",
              border: "1px solid var(--accent-blue)",
              color: "white",
              padding: "2px 4px",
              borderRadius: "2px",
            }}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename(file.id);
              if (e.key === "Escape") setEditingId(null);
            }}
            onBlur={() => setEditingId(null)}
          />
        ) : (
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "var(--fs-sm)",
              userSelect: "none",
            }}
          >
            {file.name}
          </span>
        )}

        <div
          className="file-actions"
          style={{
            display: "flex",
            gap: "4px",
            opacity: activeFileId === file.id ? 1 : 0,
          }}
        >
          {editingId === file.id ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRename(file.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-emerald)",
                  cursor: "pointer",
                }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-red)",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              {isFolder && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolder(file.id, true);
                      setCreatingState({
                        parentId: file.id,
                        type: "file",
                        name: "",
                      });
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                    title="New File"
                  >
                    <FilePlus size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolder(file.id, true);
                      setCreatingState({
                        parentId: file.id,
                        type: "folder",
                        name: "",
                      });
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                    title="New Folder"
                  >
                    <FolderPlus size={14} />
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditName(file.name);
                  setEditingId(file.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
                title="Rename"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFile(file.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {isFolder && isExpanded && (
        <div style={{ paddingLeft: "8px" }}>
          {creatingState?.parentId === file.id && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
              }}
            >
              {creatingState.type === "folder" ? (
                <Folder size={16} color="var(--accent-blue)" />
              ) : (
                <File size={16} color="var(--text-muted)" />
              )}
              <input
                autoFocus
                style={{
                  flex: 1,
                  minWidth: 0,
                  boxSizing: "border-box",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--accent-blue)",
                  color: "white",
                  padding: "2px 4px",
                  borderRadius: "2px",
                }}
                value={creatingState.name}
                onChange={(e) =>
                  setCreatingState((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setCreatingState(null);
                }}
              />
            </div>
          )}
          {sortedChildren.map((child) => (
            <FileTreeItem
              key={child.id}
              file={child}
              files={files}
              level={level + 1}
              activeFileId={activeFileId}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onSelectFile={onSelectFile}
              onCreateFile={onCreateFile}
              onDeleteFile={onDeleteFile}
              onRenameFile={onRenameFile}
              creatingState={creatingState}
              setCreatingState={setCreatingState}
              handleCreate={handleCreate}
              editingId={editingId}
              editName={editName}
              setEditName={setEditName}
              handleRename={handleRename}
              setEditingId={setEditingId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FileExplorer({
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
}) {
  const [creatingState, setCreatingState] = useState(null); // { parentId: String | null, type: 'file' | 'folder', name: String }
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const toggleFolder = (id, forceExpand = false) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (forceExpand || !next.has(id)) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleCreate = () => {
    if (creatingState && creatingState.name.trim()) {
      onCreateFile(
        creatingState.name.trim(),
        creatingState.type,
        creatingState.parentId,
      );
    }
    setCreatingState(null);
  };

  const handleRename = (id) => {
    if (editName.trim()) {
      onRenameFile(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleDownloadZip = () => {
    const zip = new JSZip();

    const getPath = (fileId) => {
      const f = files.find((x) => x.id === fileId);
      if (!f) return "";
      if (!f.parentId) return f.name;
      return getPath(f.parentId) + "/" + f.name;
    };

    files.forEach((f) => {
      if (f.type === "file") {
        zip.file(getPath(f.id), f.content);
      }
    });

    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, "cocode-project.zip");
    });
  };

  const rootFiles = files.filter((f) => f.parentId === null);
  const sortedRootFiles = rootFiles.sort((a, b) => {
    if (a.type === "folder" && b.type === "file") return -1;
    if (a.type === "file" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      className="file-explorer"
      style={{
        width: "250px",
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "var(--fs-sm)",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Project
        </h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() =>
              setCreatingState({ parentId: null, type: "file", name: "" })
            }
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
            title="New File"
          >
            <FilePlus size={16} />
          </button>
          <button
            onClick={() =>
              setCreatingState({ parentId: null, type: "folder", name: "" })
            }
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
            title="New Folder"
          >
            <FolderPlus size={16} />
          </button>
          <button
            onClick={handleDownloadZip}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
            title="Download ZIP"
          >
            <DownloadCloud size={16} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        {creatingState?.parentId === null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              marginBottom: "4px",
            }}
          >
            {creatingState.type === "folder" ? (
              <Folder size={16} color="var(--accent-blue)" />
            ) : (
              <File size={16} color="var(--text-muted)" />
            )}
            <input
              autoFocus
              style={{
                flex: 1,
                minWidth: 0,
                boxSizing: "border-box",
                background: "var(--bg-primary)",
                border: "1px solid var(--accent-blue)",
                color: "white",
                padding: "2px 4px",
                borderRadius: "2px",
              }}
              value={creatingState.name}
              onChange={(e) =>
                setCreatingState((prev) => ({ ...prev, name: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setCreatingState(null);
              }}
            />
          </div>
        )}

        {sortedRootFiles.map((file) => (
          <FileTreeItem
            key={file.id}
            file={file}
            files={files}
            level={0}
            activeFileId={activeFileId}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            onSelectFile={onSelectFile}
            onCreateFile={onCreateFile}
            onDeleteFile={onDeleteFile}
            onRenameFile={onRenameFile}
            creatingState={creatingState}
            setCreatingState={setCreatingState}
            handleCreate={handleCreate}
            editingId={editingId}
            editName={editName}
            setEditName={setEditName}
            handleRename={handleRename}
            setEditingId={setEditingId}
          />
        ))}
      </div>

      <style>{`
        .file-explorer .file-actions { opacity: 0; transition: opacity 0.2s; }
        .file-tree-row:hover .file-actions { opacity: 1 !important; }
        .file-tree-row:hover { background: rgba(255, 255, 255, 0.05) !important; }
      `}</style>
    </div>
  );
}
