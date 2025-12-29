import { useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/api-config';

/**
 * Hook to keep session alive during user activity
 * Sends heartbeat to refresh session when user is active
 */
export function useSessionHeartbeat(isAuthenticated: boolean) {
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    if (!isAuthenticated) {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      return;
    }

    // Track user activity
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    // Send heartbeat every 10 minutes if user has been active in the last 15 minutes
    heartbeatIntervalRef.current = setInterval(async () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      const fifteenMinutes = 15 * 60 * 1000;
      
      if (timeSinceActivity < fifteenMinutes) {
        try {
          await apiRequest('POST', '/auth/refresh', {});
          console.debug('[Session] Heartbeat sent successfully');
        } catch (error) {
          console.warn('[Session] Heartbeat failed:', error);
        }
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [isAuthenticated]);
}