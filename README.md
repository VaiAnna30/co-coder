# CoCode - Collaborative Real-Time IDE

CoCode is a full-stack, real-time collaborative development environment (Web IDE) that allows multiple users to write, execute, and discuss code simultaneously in a shared workspace. 

This project was built to solve the disjointed experience of remote technical interviews and pair programming by unifying communication (A/V chat) and execution (code editor + terminal) into a single, seamless browser experience.

---

## 🚀 Key Features

1. **VS-Code Style File System**: A hierarchical folder and file structure allowing users to create, rename, and delete multiple files within a single workspace.
2. **Real-time Collaborative Editor**: Built on top of Microsoft's Monaco Editor (the engine behind VS Code) with sub-second synchronization across all clients in the room.
3. **Remote Code Execution**: Integrated with the Piston API to compile and execute arbitrary code in isolated Docker containers, displaying stdout/stderr in a built-in terminal.
4. **Collaborative Whiteboard**: An HTML5 Canvas-based whiteboard supporting real-time drawing, highlighting, and shape creation for system design discussions.
5. **WebRTC Video/Audio Chat**: Native browser Peer-to-Peer (P2P) mesh networking for low-latency video and audio communication.
6. **Admin Controls & Security**: Room creators have admin privileges to admit or kick users from the workspace.

---

## 🛠 Technology Stack & Modules

### Frontend (Client)
The frontend is a **React (Vite)** Single Page Application (SPA).

*   **State Management & Routing**: `React Hooks`, `react-router-dom`.
*   **Editor Module (`@monaco-editor/react`)**: Renders the high-performance code editor.
*   **Real-time Communication Module (`socket.io-client`)**: Handles the WebSocket connection to the backend for syncing code, chat messages, and whiteboard strokes.
*   **Media Module (`WebRTC`)**: Uses `RTCPeerConnection` and `getUserMedia` to establish direct P2P media streams between users.
*   **Styling**: Vanilla CSS utilizing custom variables and CSS Grid/Flexbox for a fully responsive layout (including mobile drawer overlays and bottom navigation).

### Backend (Server)
The backend is a **Node.js / Express.js** monolithic web service.

*   **Real-time Engine (`socket.io`)**: The core of the collaborative experience. It acts as the central router for broadcasting events and as the signaling server for WebRTC.
*   **Database (`MongoDB` / `Mongoose`)**: Stores User credentials and Room data (including the deeply nested file system structures).
*   **Authentication (`jsonwebtoken`, `bcrypt`)**: Secures routes and ensures only authorized users can join rooms or execute code.

---

## 🧠 System Architecture & Deep Dive

If you are reviewing this project for a technical interview, here is a deep dive into how the core systems operate under the hood.

### 1. The Socket.io Routing Architecture
Instead of a single monolithic socket file, the backend socket logic is cleanly modularized into specific namespaces/handlers:
*   `codeHandler.js`: Manages the File System (create, delete, rename) and broadcasts `code:sync` and `code:change` events.
*   `whiteboardHandler.js`: Broadcasts X/Y coordinates arrays for drawing strokes.
*   `videoHandler.js`: Acts strictly as a **Signaling Server** for WebRTC (passing SDP offers, answers, and ICE candidates).

**Challenge Solved (The Echo Bug):** Initially, when a user typed code, the server used `io.to().emit()`, broadcasting the change back to the sender. This caused an infinite loop where the sender's editor updated, firing another change event. This was solved by utilizing `socket.to().emit()` (broadcasting to everyone *except* the sender) and implementing an `isRemoteUpdate` React `useRef` flag to safely ignore programmatic editor changes.

### 2. WebRTC Data Flow (Video/Audio)
The video conferencing does **not** stream video data through the Node.js server. It uses a **Full Mesh P2P Topology**.
1.  **Signaling**: When User B joins, they create an `RTCPeerConnection` and generate an **SDP Offer**. This tiny text payload is sent via Socket.io to User A.
2.  **Answering**: User A receives the offer, sets it as their `RemoteDescription`, and sends back an **SDP Answer**.
3.  **ICE Candidates**: Both browsers ping public STUN servers to discover their own public IP addresses, and exchange these ICE candidates via Socket.io.
4.  **P2P Connection**: Once candidates are exchanged, the Socket.io server steps out of the way. Video and audio packets flow directly between Browser A and Browser B via UDP, drastically reducing server bandwidth and latency.

### 3. Remote Code Execution (Piston API)
Running arbitrary user code on a Node.js server is a massive security vulnerability (Remote Code Execution attack). 
To solve this, the application offloads code execution to the **Piston API**. When a user clicks "Run":
1. The active file's code and language are packaged into a JSON payload.
2. The Node server proxies this request to Piston.
3. Piston spins up a secure, ephemeral **Docker Container** configured specifically for that language.
4. The code is compiled and executed inside the sandbox, and the `stdout`/`stderr` streams are returned to the user's terminal safely.

### 4. Database Schema Design
The MongoDB database is optimized for quick room retrieval. The `Room` schema contains a nested `files` array:
```javascript
files: [{
  id: String,
  name: String,
  type: { type: String, enum: ['file', 'folder'] },
  parentId: String, // Null for root level, enables infinite nesting
  content: String,
  language: String
}]
```
This flat-array approach with `parentId` pointers allows the frontend to easily reconstruct the hierarchical file tree recursively without requiring expensive graph lookups on the database level.

---

## 📱 Responsive UI & Mobile Architecture
Building an IDE for mobile devices required strict layout control:
*   **File Explorer Drawer**: On mobile (`< 768px`), the File Explorer hides off-screen and becomes a slide-out drawer (`transform: translateX(-100%)`) toggled via a hamburger menu, preventing it from crushing the editor.
*   **Invisible Overlay Blocks**: The Chat and Video panels become full-screen overlays on mobile. A major bug was fixed where collapsed panels were retaining their width and blocking UI clicks; this was solved using `pointer-events: none` and `visibility: hidden` dynamically.
*   **Bottom Navigation**: The sidebar intelligently shifts to a mobile-app style bottom navigation bar on small screens to maximize horizontal coding space.

---

## 🔮 Future Improvements
*   **CRDT Integration**: Upgrading the simple "last-write-wins" socket broadcasting to use Conflict-Free Replicated Data Types (CRDTs) like `Yjs` for true Google-Docs style simultaneous editing with multi-colored cursors.
*   **WebRTC SFU**: Migrating from a Full Mesh topology to an SFU (Selective Forwarding Unit) media server to support 50+ participants in a single room without exhausting client bandwidth.
*   **GitHub Integration**: Allowing users to clone public repositories directly into the CoCode file system.
