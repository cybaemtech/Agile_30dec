import { QueryClient, QueryFunction } from "@tanstack/react-query";
// Import all API functions from the unified config to ensure single source of truth
import { 
  apiRequest as configApiRequest,
  apiGet as configApiGet,
  apiPost as configApiPost,
  apiPatch as configApiPatch,
  apiDelete as configApiDelete,
  apiCall as configApiCall,
  API_BASE_URL
} from "@/lib/api-config";

// Utility function to ensure endpoint starts with '/'
const normalizeEndpoint = (endpoint: string): string => {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Re-export the unified API functions to maintain compatibility
export const apiRequest = configApiRequest;
export const apiGet = configApiGet;
export const apiPost = configApiPost;
export const apiPatch = configApiPatch;
export const apiDelete = configApiDelete;
export const apiCall = configApiCall;

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const endpoint = queryKey[0] as string;
    const normalizedEndpoint = endpoint.startsWith('http') ? endpoint : normalizeEndpoint(endpoint);
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${normalizedEndpoint}`;
    
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
