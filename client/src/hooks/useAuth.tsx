import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User } from "../../../shared/schema";
import { apiGet, apiRequest } from "@/lib/api-config";
import { useEffect, useState } from "react";

export function useAuth() {
  const queryClient = useQueryClient();
  const [initialized, setInitialized] = useState(false);
  
  const {
    data: user,
    isLoading,
    isError,
    error,
  } = useQuery<User>({
    queryKey: ['/auth/user'],
    queryFn: async () => {
      console.log('[useAuth] Fetching user data');
      setInitialized(true);
      try {
        const result = await apiGet('/auth/user');
        console.log('[useAuth] User data received:', result);
        return result;
      } catch (error: any) {
        console.log('[useAuth] Auth error:', error);
        // For 401/403 errors, return null instead of throwing
        if (error?.status === 401 || error?.status === 403) {
          console.log('[useAuth] User not authenticated, returning null');
          return null;
        }
        throw error;
      }
    },
    retry: false, // Don't retry auth failures
    staleTime: 1000, // Very short stale time for immediate updates
    refetchOnWindowFocus: false, // Don't auto-refetch on focus to avoid loops
    refetchOnReconnect: false, // Disable reconnect refetch
    refetchInterval: false, // Disable automatic refetching
    refetchIntervalInBackground: false,
    // Return immediately for 401 errors
    throwOnError: false,
    // Don't show loading for auth checks
    networkMode: 'online',
  });

  // Auto-refresh session every 30 minutes
  useEffect(() => {
    if (!user) return;

    const refreshSession = async () => {
      try {
        await apiRequest('POST', '/auth/refresh', {});
        // Invalidate user query to refetch fresh data
        queryClient.invalidateQueries({ queryKey: ['/auth/user'] });
      } catch (error) {
        console.warn('Session refresh failed:', error);
      }
    };

    const interval = setInterval(refreshSession, 30 * 60 * 1000); // 30 minutes
    
    return () => clearInterval(interval);
  }, [user, queryClient]);

  // Determine authentication state immediately
  // user is undefined = query hasn't run yet
  // user is null = query ran and returned 401/null  
  // user is object = user is authenticated
  const isAuthenticated = !!user && typeof user === 'object' && user !== null;
  const isUnauthenticated = user === null || (isError && (error as any)?.status === 401);
  
  // Only show loading when we truly don't know the auth state yet
  // Once user is null or an object, we're no longer loading
  const shouldShowLoading = user === undefined && isLoading;
  
  console.log('[useAuth] State:', { 
    user: user === undefined ? 'undefined' : user === null ? 'null' : 'object', 
    isLoading, 
    isError, 
    isAuthenticated, 
    isUnauthenticated, 
    shouldShowLoading 
  });
  
  return {
    user,
    isLoading: shouldShowLoading,
    isError,
    error,
    isAuthenticated,
    isUnauthenticated,
  };
}
