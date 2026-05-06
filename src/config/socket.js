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
    pingInterval: 25000,
    pingTimeout:  60000,
  });


  ioInstance.use((socket, next) => {
    try {
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


  ioInstance.on('connection', (socket) => {
    const workspaceRoom = `workspace:${socket.workspaceId}`;

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

    socket.on('error', (err) => {
      logger.warn({ err: err.message, userId: socket.userId }, 'Socket error');
    });
  });

  logger.info('Socket.io initialised');
  return ioInstance;
};  
const getIO = () => ioInstance;

module.exports = { initSocket, getIO };