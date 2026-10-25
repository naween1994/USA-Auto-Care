import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

let sharedSocket = null;

/**
 * Singleton Socket.IO Synchronization Hook:
 * - Authenticates via HTTP-only cookie
 * - Prevents duplicate socket subscriptions across component mounts
 * - Automatically invalidates relevant TanStack Query keys when the server commits a change
 * - Refetches active queries on socket reconnection to recover any missed events
 */
export function useSocketSync(user) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      if (sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
      }
      return undefined;
    }

    if (!sharedSocket) {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
      sharedSocket = io(socketUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity,
      });
    }

    const onConnect = () => {
      setIsConnected(true);
      // Refetch active queries on reconnect to recover missed real-time events
      queryClient.invalidateQueries();
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onDomainUpdated = (event) => {
      const entity = event?.entity;
      if (entity) {
        queryClient.invalidateQueries({ queryKey: [entity] });
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    // Remove prior listeners before attaching to prevent duplicate subscriptions
    sharedSocket.off('connect', onConnect);
    sharedSocket.off('disconnect', onDisconnect);
    sharedSocket.off('domain:updated', onDomainUpdated);

    sharedSocket.on('connect', onConnect);
    sharedSocket.on('disconnect', onDisconnect);
    sharedSocket.on('domain:updated', onDomainUpdated);

    return () => {
      if (sharedSocket) {
        sharedSocket.off('connect', onConnect);
        sharedSocket.off('disconnect', onDisconnect);
        sharedSocket.off('domain:updated', onDomainUpdated);
      }
    };
  }, [user, queryClient]);

  return { isConnected };
}
