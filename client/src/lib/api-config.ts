import { queryClient } from "./queryClient";

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Use local proxy when running on localhost to avoid CORS issues
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '/api'; // Vite proxy will forward to remote API
    }
    
    // Production deployment on cybaemtech.in
    if (window.location.hostname === 'cybaemtech.in' ||
        window.location.hostname === 'www.cybaemtech.in') {
      // Always use /Agile/api for production on cybaemtech.in
      return '/Agile/api';
    }
    
    // Check if we're running in production deployment with /Agile path
    if (window.location.pathname.startsWith('/Agile/') || window.location.pathname === '/Agile') {
      return '/Agile/api';
    }
    
    // Fallback for other deployment environments
    if (window.location.port === '' && window.location.protocol === 'https:') {
      // Likely production without explicit hostname check
      return '/Agile/api';
    }
  }
  
  // Use environment variable if set, otherwise default to /api for local development
  return import.meta.env.VITE_API_BASE_URL || '/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Utility function to ensure endpoint starts with '/'
const normalizeEndpoint = (endpoint: string): string => {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
};

export const apiRequest = async (
  method: string,
  endpoint: string,
  data?: unknown
): Promise<Response> => {
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  console.log(`[API] ${method} ${url}`, data);
  console.log(`[API] Base URL: ${API_BASE_URL}, Window Location:`, {
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    port: window.location.port,
    protocol: window.location.protocol
  });

  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    console.log(`[API] Response: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const text = await res.text();

      // Handle 401 specifically for session management
      if (res.status === 401) {
        console.debug(`[API] 401 Unauthorized:`, text);
        
        // Create a specific 401 error that useAuth can handle
        const error = new Error(`401: Not authenticated`);
        (error as any).status = 401;
        (error as any).response = { status: res.status, data: { message: 'Not authenticated' } };
        throw error;
      } else {
        console.error(`[API] Error response:`, text);
      }

      try {
        const errorData = JSON.parse(text);
        const error = new Error(`${res.status}: ${errorData.message || res.statusText}`);
        (error as any).response = { status: res.status, data: errorData };
        throw error;
      } catch (parseError) {
        // If not JSON, use the text as is
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }
    }

    return res;
  } catch (error) {
    // Don't log 401 errors as failures, they are expected during auth checks
    if ((error as any)?.response?.status !== 401) {
      console.error(`[API] Request failed:`, error);
    }
    throw error;
  }
};

export const apiGet = async (endpoint: string) => {
  const res = await apiRequest('GET', endpoint);
  return res.json();
};

export const apiPost = async (endpoint: string, data: unknown) => {
  const res = await apiRequest('POST', endpoint, data);
  return res.json();
};

export const apiPatch = async (endpoint: string, data: unknown) => {
  const res = await apiRequest('PATCH', endpoint, data);
  return res.json();
};

export const apiDelete = async (endpoint: string) => {
  const res = await apiRequest('DELETE', endpoint);
  return res.status === 204 ? null : res.json();
};

// Export a unified function that can handle all HTTP methods
export const apiCall = async (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  data?: unknown
): Promise<any> => {
  const res = await apiRequest(method, endpoint, data);
  return res.status === 204 ? null : res.json();
};