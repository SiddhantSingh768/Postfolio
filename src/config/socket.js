const { Server }          = require('socket.io');
const { verifyAccessToken } = require('../utils/tokenUtils');
const logger              = require('./logger');

let ioInstance = null;

const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin:      process.env.CLIENT_URL,
      credentials: true,
    },
    // Ping every 25 seconds, disconnect after 60 seconds of no response
    pingInterval: 25000,
    pingTimeout:  60000,
  });

  // ── Authentication middleware ──────────────────────────────────────────────
  // Every socket connection must present a valid JWT access token.
  // This runs before the connection is established.
  // If it fails, the connection is rejected.

  ioInstance.use((socket, next) => {
    try {
      // Token comes from the handshake auth object
      // Frontend sends: socket = io(url, { auth: { token: accessToken } })
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('NO_TOKEN'));
      }

      const decoded         = verifyAccessToken(token);
      socket.userId         = decoded.userId;
      socket.workspaceId    = decoded.workspaceId;
      socket.role           = decoded.role;

      next(); // Allow connection
    } catch (err) {
      logger.warn({ err: err.message }, 'Socket auth failed');
      next(new Error('INVALID_TOKEN'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────

  ioInstance.on('connection', (socket) => {
    const workspaceRoom = `workspace:${socket.workspaceId}`;

    // Join workspace-scoped room
    // All events for this freelancer are emitted to this room
    socket.join(workspaceRoom);

    logger.info(
      { userId: socket.userId, workspaceId: socket.workspaceId, room: workspaceRoom },
      'Socket connected'
    );

    socket.on('disconnect', (reason) => {
      logger.info(
        { userId: socket.userId, reason },
        'Socket disconnected'
      );
    });

    // Error handler — prevents unhandled errors from crashing the process
    socket.on('error', (err) => {
      logger.warn({ err: err.message, userId: socket.userId }, 'Socket error');
    });
  });

  logger.info('Socket.io initialised');
  return ioInstance;
};

// Getter used by services to emit events
// Returns null if Socket.io hasn't been initialised yet
const getIO = () => ioInstance;

module.exports = { initSocket, getIO };