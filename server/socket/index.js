const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Room = require("../models/Room");

// Import Sub-handlers, we split the logic by feature.
// These files will attach specific event listeners (like 'chat:send' or 'code:type') to the socket.
const registerCodeHandler = require("./codeHandler");
const registerWhiteboardHandler = require("./whiteboardHandler");
const registerChatHandler = require("./chatHandler");
const registerVideoHandler = require("./videoHandler");

// This function takes the standard Express HTTP server and wraps it with Socket.io capabilities.
const initSocket = (httpServer) => {
  // Create a new Socket.io Server instance attached to our existing HTTP server.
  const io = new Server(httpServer, {
    // CORS (Cross-Origin Resource Sharing) is a security feature.
    // It dictates which external websites are allowed to connect to this socket server.
    cors: {
      origin: "*", // '*' means ANY website can connect.
      methods: ["GET", "POST"], // Allowable HTTP methods for the initial connection handshake.
    },
  });

  //  io.use() acts as a gatekeeper. EVERY single user who tries to connect to the socket
  //  must pass through this function first. If they fail, the connection is rejected.

  io.use(async (socket, next) => {
    try {
      // The "handshake" is the very first HTTP request the client sends to establish the WebSocket.
      // We look for the JWT token in either the 'auth' object or the URL 'query' parameters.
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.token;

      // If no token is found, we call next() with an Error, which instantly kicks the user out.
      if (!token) {
        return next(new Error("Authentication error — no token provided"));
      }

      // jwt.verify cryptographically checks if the token was created by our server and hasn't expired.
      // It uses the secret key from our .env file. If valid, it returns the decoded payload (which contains the user ID).
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Look up the user in MongoDB using the ID from the token.
      // .select('-password') ensures we don't pull their hashed password from the database into memory for security.
      const user = await User.findById(decoded.id).select("-password");

      // If the token is mathematically valid but the user was deleted from the database, reject them.
      if (!user) {
        return next(new Error("Authentication error — user not found"));
      }

      // CRITICAL STEP: Attach the verified database user object directly to the 'socket' object.
      // This means anywhere else in our code where we have 'socket', we automatically know EXACTLY who they are (socket.user).
      socket.user = user;

      // Call next() with no errors to let them successfully connect to the socket server.
      next();
    } catch (error) {
      console.error("Socket auth error:", error.message);
      // If jwt.verify fails (e.g., token expired or manipulated), reject the connection.
      next(new Error("Authentication error — token invalid or expired"));
    }
  });

  /*
   * io.on('connection') fires the moment a user successfully passes the middleware above.
   * The 'socket' parameter represents that ONE specific user's individual connection to the server.
   */
  io.on("connection", (socket) => {
    // Log that a user connected. socket.id is a temporary, unique gibberish string assigned to this specific browser tab.
    console.log(`⚡ Socket connected: ${socket.user.username} (${socket.id})`);

    // socket.join() puts a user into a logical "room" (a grouping of sockets).
    // By forcing the user to join a room named after their unique database ID,
    // we create a private channel just for them. Later, if we want to send a direct message
    // ONLY to this user across the entire app, we can just say: io.to(userId).emit(...)
    socket.join(socket.user._id.toString());

    /*
     * Triggered when the frontend asks to enter a specific collaboration room.
     */
    socket.on("room:join", async ({ roomCode }) => {
      try {
        // Find the room in MongoDB and populate the 'participants' array with real user data (username/email).
        const room = await Room.findOne({ roomCode }).populate(
          "participants",
          "username email",
        );

        // If someone typed a fake code, emit an error exclusively back to the person who asked.
        if (!room)
          return socket.emit("error:message", { message: "Room not found" });

        // Check if the current user (socket.user._id) actually exists in the room's participant list.
        const isParticipant = room.participants.some((p) =>
          p._id.equals(socket.user._id),
        );

        // If they aren't approved, reject the join attempt via the socket.
        if (!isParticipant)
          return socket.emit("error:message", {
            message: "You are not a participant of this room",
          });

        // Subscribe this socket to the specific room's communication channel.
        socket.join(roomCode);

        // Save the current room code directly on the socket object as a temporary variable so we remember where they are.
        socket.currentRoom = roomCode;

        // socket.to(roomCode).emit() -> Broadcasts a message to EVERYONE inside 'roomCode', EXCEPT the person who just joined.
        // It tells the existing users: "Hey, someone new just walked in!"
        socket
          .to(roomCode)
          .emit("room:user-joined", {
            userId: socket.user._id,
            username: socket.user.username,
          });

        // socket.emit() -> Sends a message ONLY back to the person who triggered this event.
        // Gives them the successful room details and the list of people already inside.
        socket.emit("room:joined", {
          roomCode,
          participants: room.participants,
        });
      } catch (error) {
        socket.emit("error:message", { message: "Failed to join room" });
      }
    });

    /*
     * Triggered when an unapproved user asks to be let in.
     */
    socket.on("room:request-join", ({ roomCode }) => {
      // Broadcast this request to everyone currently in the room.
      // The frontend will usually show a popup to the Admin saying "User X wants to join".
      socket
        .to(roomCode)
        .emit("room:join-request", {
          userId: socket.user._id,
          username: socket.user.username,
        });
    });

    /*
     * Triggered when the Admin clicks "Accept" on a pending user.
     */
    socket.on("room:admit-user", ({ roomCode, userId }) => {
      // io.to(userId).emit() -> Sends a global message directly to the waiting user's "Personal Room" (setup on line 111).
      // This tells their browser: "You were approved! Refresh or transition into the room!"
      io.to(userId.toString()).emit("room:admitted", { roomCode });
    });

    /*
     * Triggered when an Admin decides to remove someone from the workspace.
     */
    socket.on("room:kick", async ({ roomCode, targetUserId }) => {
      try {
        // MongoDB operation: Find the room by code, and use $pull to forcefully remove
        // the target user's ID from the 'participants' array in the database.
        await Room.findOneAndUpdate(
          { roomCode },
          { $pull: { participants: targetUserId } },
        );

        // Emit a direct message to the kicked user's personal channel telling their frontend to redirect them to the home page.
        io.to(targetUserId.toString()).emit("room:kicked", { roomCode });

        // Notify everyone else remaining in the room that this user has vanished.
        socket.to(roomCode).emit("room:user-left", { userId: targetUserId });
      } catch (err) {
        console.error("Kick error:", err);
      }
    });

    /*
     * Triggered when a user voluntarily clicks a "Leave Room" button.
     */
    socket.on("room:leave", ({ roomCode }) => {
      // socket.leave() physically removes this socket from the room's communication channel.
      socket.leave(roomCode);

      // Clear out the temporary variable tracking their location.
      socket.currentRoom = null;

      // Tell everyone else in the room that this user left.
      socket
        .to(roomCode)
        .emit("room:user-left", {
          userId: socket.user._id,
          username: socket.user.username,
        });
    });

    /*
     * We pass the global 'io' instance and this specific user's 'socket' to our
     * external files. Those files will now attach listeners for drawing on the
     * whiteboard, typing code, sending chat messages, etc.
     */
    registerCodeHandler(io, socket);
    registerWhiteboardHandler(io, socket);
    registerChatHandler(io, socket);
    registerVideoHandler(io, socket);

    /*
     * 'disconnect' is a built-in event that fires automatically if the user closes
     * the browser tab, loses internet connection, or navigates to a new website.
     */
    socket.on("disconnect", () => {
      console.log(
        `🔌 Socket disconnected: ${socket.user.username} (${socket.id})`,
      );

      // If the server remembers that they were actively sitting in a room when their internet dropped...
      if (socket.currentRoom) {
        // ...broadcast to everyone else in that room that this user suddenly disconnected.
        socket.to(socket.currentRoom).emit("room:user-left", {
          userId: socket.user._id,
          username: socket.user.username,
        });
      }
    });
  });

  // Finally, return the fully configured Socket.io server back to the main server.js file to start running.
  return io;
};

// Export the setup function so it can be used elsewhere in the application.
module.exports = initSocket;
