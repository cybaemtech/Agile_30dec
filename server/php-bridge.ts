import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class PhpBridge {
  private apiPath: string;

  constructor() {
    this.apiPath = path.resolve(process.cwd(), 'api');
  }

  async executePhp(scriptPath: string, requestData: any = {}): Promise<any> {
    try {
      // Set environment variables for the PHP script
      const env = {
        ...process.env,
        REQUEST_METHOD: requestData.method || 'GET',
        REQUEST_URI: requestData.uri || '/',
        QUERY_STRING: requestData.query || '',
        CONTENT_TYPE: 'application/json',
        HTTP_ORIGIN: 'http://localhost:5000'
      };

      // Prepare the PHP command
      const phpScript = path.join(this.apiPath, scriptPath);
      const inputData = requestData.body ? JSON.stringify(requestData.body) : '';
      
      const command = `echo '${inputData}' | php -f "${phpScript}"`;
      
      const { stdout, stderr } = await execAsync(command, { 
        env,
        cwd: this.apiPath 
      });

      if (stderr) {
        console.error('PHP Error:', stderr);
        throw new Error(stderr);
      }

      return JSON.parse(stdout || '{}');
    } catch (error) {
      console.error('PHP Bridge Error:', error);
      throw error;
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.executePhp('auth.php', {
      method: 'POST',
      uri: '/auth/login',
      body: { email, password }
    });
  }

  async logout() {
    return this.executePhp('auth.php', {
      method: 'POST',
      uri: '/auth/logout'
    });
  }

  async getAuthStatus() {
    return this.executePhp('auth.php', {
      method: 'GET',
      uri: '/auth/status'
    });
  }

  async getCurrentUser() {
    return this.executePhp('auth.php', {
      method: 'GET',
      uri: '/auth/user'
    });
  }

  // Project endpoints
  async getProjects() {
    return this.executePhp('projects.php', {
      method: 'GET',
      uri: '/projects'
    });
  }

  async getProject(id: number) {
    return this.executePhp('projects.php', {
      method: 'GET',
      uri: `/projects/${id}`
    });
  }

  async createProject(projectData: any) {
    return this.executePhp('projects.php', {
      method: 'POST',
      uri: '/projects',
      body: projectData
    });
  }

  async getWorkItems(projectId: number) {
    return this.executePhp('projects.php', {
      method: 'GET',
      uri: `/projects/${projectId}/work-items`
    });
  }

  // User endpoints
  async getUsers() {
    return this.executePhp('users.php', {
      method: 'GET',
      uri: '/users'
    });
  }

  async getUser(id: number) {
    return this.executePhp('users.php', {
      method: 'GET',
      uri: `/users/${id}`
    });
  }

  // Team endpoints
  async getTeams() {
    return this.executePhp('teams.php', {
      method: 'GET',
      uri: '/teams'
    });
  }

  async getTeam(id: number) {
    return this.executePhp('teams.php', {
      method: 'GET',
      uri: `/teams/${id}`
    });
  }

  async getTeamMembers(teamId: number) {
    return this.executePhp('teams.php', {
      method: 'GET',
      uri: `/teams/${teamId}/members`
    });
  }
}