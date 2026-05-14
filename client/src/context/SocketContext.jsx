import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const socketRef  = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Socket.io is disabled on Vercel serverless deployments
    // Only attempt connection if socket.io-client is available
    // and a socket URL is configured
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL;

    // If no socket URL configured (Vercel deployment), skip silently
    if (!socketUrl) {
      return;
    }

    // Dynamically import socket.io-client only when needed
    // This prevents build errors when the package is not installed
    import('socket.io-client').then(({ io }) => {
      if (!isAuthenticated || !token) return;

      socketRef.current = io(socketUrl, {
        auth:            { token },
        transports:      ['websocket'],
        reconnection:    true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      socketRef.current.on('connect', () => {
        setConnected(true);
      });

      socketRef.current.on('disconnect', () => {
        setConnected(false);
      });

      socketRef.current.on('connect_error', () => {
        setConnected(false);
      });
    }).catch(() => {
      // socket.io-client not installed — real-time disabled
      console.info('Socket.io not available — real-time updates disabled');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
    };
  }, [isAuthenticated, token]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside SocketProvider');
  return ctx;
};