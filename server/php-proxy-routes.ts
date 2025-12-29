import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

const phpProxyRouter = Router();

// Store PHP session cookies per user session
const phpSessionMap = new Map<string, string>();

// Helper to get a consistent session key
function getSessionKey(req: Request): string {
  // First try to get Express session ID
  const expressSession = (req as any).session?.id;
  
  // Fallback to using a combination of session data or IP
  const sessionData = (req as any).session;
  if (sessionData && sessionData.userId) {
    return `user_${sessionData.userId}`;
  }
  
  // Use Express session ID as last resort
  return expressSession || 'default';
}

const EXTERNAL_API_BASE = 'https://cybaemtech.in/Agile/api';

// Helper function to make requests to external PHP API
async function proxyToPhpApi(
  method: string,
  endpoint: string,
  body?: any,
  sessionId?: string
): Promise<{ response: any; cookies?: string }> {
  const url = `${EXTERNAL_API_BASE}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add stored PHP session cookie if available
  if (sessionId && phpSessionMap.has(sessionId)) {
    headers['Cookie'] = phpSessionMap.get(sessionId)!;
    console.log('Using PHP session cookie:', phpSessionMap.get(sessionId));
  } else if (sessionId) {
    console.log('No PHP session found for key:', sessionId);
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  // Extract Set-Cookie header to store PHP session
  const setCookie = res.headers.get('set-cookie');
  
  const responseData = await res.text();
  let jsonData;
  try {
    jsonData = JSON.parse(responseData);
  } catch {
    jsonData = { message: responseData };
  }
  
  return {
    response: {
      status: res.status,
      data: jsonData
    },
    cookies: setCookie || undefined
  };
}

// Proxy authentication routes
phpProxyRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const result = await proxyToPhpApi('POST', '/auth/login', req.body);
    
    // Store PHP session cookie if login successful
    if (result.cookies && result.response.status === 200) {
      // Store user ID in Express session FIRST
      if (result.response.data.user?.id) {
        (req as any).session.userId = result.response.data.user.id;
      }
      
      // Now get session key (which will use the user ID we just set)
      const sessionKey = getSessionKey(req);
      
      console.log('Login successful - storing PHP session for key:', sessionKey);
      console.log('PHP cookies:', result.cookies);
      phpSessionMap.set(sessionKey, result.cookies);
    }
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy login error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.get('/auth/status', async (req: Request, res: Response) => {
  try {
    const sessionKey = getSessionKey(req);
    const result = await proxyToPhpApi('GET', '/auth/status', undefined, sessionKey);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy auth status error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.get('/auth/user', async (req: Request, res: Response) => {
  try {
    const sessionKey = getSessionKey(req);
    const result = await proxyToPhpApi('GET', '/auth/user', undefined, sessionKey);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy auth user error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('POST', '/auth/logout', req.body, sessionId);
    
    // Clear stored PHP session on logout
    if (sessionId && phpSessionMap.has(sessionId)) {
      phpSessionMap.delete(sessionId);
    }
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy logout error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

// Proxy projects routes
phpProxyRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('GET', '/projects', undefined, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy projects GET error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.post('/projects', async (req: Request, res: Response) => {
  try {
    const sessionKey = getSessionKey(req);
    console.log('Creating project - session key:', sessionKey);
    console.log('Available PHP sessions:', Array.from(phpSessionMap.keys()));
    console.log('PHP session exists:', phpSessionMap.has(sessionKey));
    
    const result = await proxyToPhpApi('POST', '/projects', req.body, sessionKey);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy projects POST error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('GET', `/projects/${req.params.id}`, undefined, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy project GET error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.patch('/projects/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('PATCH', `/projects/${req.params.id}`, req.body, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy project PATCH error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('DELETE', `/projects/${req.params.id}`, undefined, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy project DELETE error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.get('/projects/:id/work-items', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('GET', `/projects/${req.params.id}/work-items`, undefined, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy work items GET error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

// Proxy teams routes
phpProxyRouter.get('/teams', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('GET', '/teams', undefined, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy teams GET error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.post('/teams', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('POST', '/teams', req.body, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy teams POST error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.get('/teams/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('GET', `/teams/${req.params.id}`, undefined, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy team GET error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.patch('/teams/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('PATCH', `/teams/${req.params.id}`, req.body, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy team PATCH error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.delete('/teams/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('DELETE', `/teams/${req.params.id}`, undefined, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy team DELETE error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

// Proxy users routes
phpProxyRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('GET', '/users', undefined, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy users GET error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

phpProxyRouter.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi('GET', `/users/${req.params.id}`, undefined, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy user GET error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

// Generic catchall for other endpoints
phpProxyRouter.all('/*', async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.id;
    const result = await proxyToPhpApi(req.method, req.url, req.body, sessionId);
    
    res.status(result.response.status).json(result.response.data);
  } catch (error) {
    console.error('PHP proxy generic error:', error);
    res.status(500).json({ message: 'Proxy error' });
  }
});

export { phpProxyRouter };