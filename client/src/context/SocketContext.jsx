import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const socketRef  = useRef(null);
  const [connected, setConnected] = useState(false);

// In SocketContext.jsx — update the useEffect dependencies
// to reconnect when the token changes after refresh

useEffect(() => {
  if (!isAuthenticated || !token) {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
    return;
  }

  // If socket exists with same token, don't reconnect
  if (socketRef.current?.connected) return;

  // Disconnect old socket before creating new one
  if (socketRef.current) {
    socketRef.current.disconnect();
  }

  socketRef.current = io(
    import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
    {
      auth:              { token },  // Token is in dependency array
      transports:        ['websocket'],
      reconnection:      true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    }
  );

  socketRef.current.on('connect', () => {
    setConnected(true);
  });

  socketRef.current.on('disconnect', (reason) => {
    setConnected(false);
    // Auto-reconnect unless manually disconnected
    if (reason === 'io server disconnect') {
      socketRef.current?.connect();
    }
  });

  socketRef.current.on('connect_error', () => {
    setConnected(false);
  });

  return () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  };
}, [isAuthenticated, token]); // token in deps = reconnect on refresh

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