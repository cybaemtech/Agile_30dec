import type { Express, Request, Response } from "express";
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export function registerPhpApiRoutes(app: Express) {
  const apiPath = path.resolve(process.cwd(), 'api');

  // Helper function to execute PHP scripts
  async function executePhpScript(scriptName: string, req: Request, res: Response) {
    try {
      // Prepare environment variables for PHP
      const env: Record<string, string> = {
        ...process.env,
        REQUEST_METHOD: req.method,
        REQUEST_URI: req.originalUrl,
        QUERY_STRING: req.url.split('?')[1] || '',
        CONTENT_TYPE: 'application/json',
        HTTP_ORIGIN: req.get('origin') || 'http://localhost:5000'
      };

      // Prepare input data for PHP
      const inputData = req.body ? JSON.stringify(req.body) : '';
      const phpScript = path.join(apiPath, scriptName);
      
      // Set additional environment variables for PHP to read the request body
      if (inputData) {
        env.HTTP_CONTENT_LENGTH = Buffer.byteLength(inputData, 'utf8').toString();
        env.CONTENT_LENGTH = env.HTTP_CONTENT_LENGTH;
      }
      
      // Execute PHP script
      const command = inputData 
        ? `echo '${inputData.replace(/'/g, "'\\''")}' | php -f "${phpScript}"`
        : `php -f "${phpScript}"`;
      
      const { stdout, stderr } = await execAsync(command, { 
        env,
        cwd: apiPath,
        timeout: 10000 // 10 second timeout
      });

      if (stderr) {
        console.error('PHP Error:', stderr);
        res.status(500).json({ error: 'PHP execution error', details: stderr });
        return;
      }

      // Try to parse JSON response
      try {
        const result = JSON.parse(stdout || '{}');
        res.json(result);
      } catch (parseError) {
        // If not JSON, send as text
        res.send(stdout);
      }
    } catch (error) {
      console.error('PHP Execution Error:', error);
      res.status(500).json({ error: 'Failed to execute PHP script' });
    }
  }

  // Auth routes
  app.post('/api/php/auth/login', (req, res) => executePhpScript('auth.php', req, res));
  app.post('/api/php/auth/logout', (req, res) => executePhpScript('auth.php', req, res));
  app.get('/api/php/auth/status', (req, res) => executePhpScript('auth.php', req, res));
  app.get('/api/php/auth/user', (req, res) => executePhpScript('auth.php', req, res));

  // User routes
  app.get('/api/php/users', (req, res) => executePhpScript('users.php', req, res));
  app.get('/api/php/users/:id', (req, res) => executePhpScript('users.php', req, res));
  app.post('/api/php/users', (req, res) => executePhpScript('users.php', req, res));

  // Team routes
  app.get('/api/php/teams', (req, res) => executePhpScript('teams.php', req, res));
  app.get('/api/php/teams/:id', (req, res) => executePhpScript('teams.php', req, res));
  app.get('/api/php/teams/:id/members', (req, res) => executePhpScript('teams.php', req, res));
  app.post('/api/php/teams', (req, res) => executePhpScript('teams.php', req, res));
  app.post('/api/php/teams/:id/members', (req, res) => executePhpScript('teams.php', req, res));

  // Project routes
  app.get('/api/php/projects', (req, res) => executePhpScript('projects.php', req, res));
  app.get('/api/php/projects/:id', (req, res) => executePhpScript('projects.php', req, res));
  app.get('/api/php/projects/:id/work-items', (req, res) => executePhpScript('projects.php', req, res));
  app.post('/api/php/projects', (req, res) => executePhpScript('projects.php', req, res));
  app.patch('/api/php/projects/:id', (req, res) => executePhpScript('projects.php', req, res));
  app.delete('/api/php/projects/:id', (req, res) => executePhpScript('projects.php', req, res));

  // Test route to verify PHP is working
  app.get('/api/php/test', async (req, res) => {
    try {
      const { stdout } = await execAsync('php -r "echo json_encode([\'message\' => \'PHP backend is working\', \'version\' => PHP_VERSION]);"');
      res.json(JSON.parse(stdout));
    } catch (error) {
      res.status(500).json({ error: 'PHP not available' });
    }
  });

  // Database test route that matches the specific path structure
  app.get('/Agile/agilephp%20(4)/agilephp/api/test-db', async (req, res) => {
    try {
      // Test MySQL database connection
      const mysql = await import('mysql2/promise');
      
      // Use your provided MySQL credentials
      const connectionConfig = {
        host: 'localhost',
        port: 3306,
        user: 'cybaemtech_Agile',
        password: 'Agile@9090$',
        database: 'cybaemtech_Agile'
      };
      
      console.log('Testing MySQL connection with config:', {
        host: connectionConfig.host,
        port: connectionConfig.port,
        user: connectionConfig.user,
        database: connectionConfig.database
      });
      
      const connection = await mysql.createConnection(connectionConfig);
      
      // Test the connection with a simple query
      const [rows] = await connection.execute('SELECT 1 as test, NOW() as current_time, DATABASE() as db_name');
      
      await connection.end();
      
      res.json({
        success: true,
        message: 'MySQL database connection successful!',
        database: connectionConfig.database,
        test_result: rows[0],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Database connection error:', error);
      res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: error.message,
        code: error.code,
        errno: error.errno,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Also add decoded version and a simple test route
  app.get('/Agile/agilephp (4)/agilephp/api/test-db', async (req, res) => {
    // This handles the URL-decoded version of the path
    try {
      const mysql = await import('mysql2/promise');
      
      const connectionConfig = {
        host: 'localhost',
        port: 3306,
        user: 'cybaemtech_Agile',
        password: 'Agile@9090$',
        database: 'cybaemtech_agile'
      };
      
      console.log('Testing MySQL connection with config:', {
        host: connectionConfig.host,
        port: connectionConfig.port,
        user: connectionConfig.user,
        database: connectionConfig.database
      });
      
      const connection = await mysql.createConnection(connectionConfig);
      const [rows] = await connection.execute('SELECT 1 as test, NOW() as current_time, DATABASE() as db_name');
      await connection.end();
      
      res.json({
        success: true,
        message: 'MySQL database connection successful!',
        database: connectionConfig.database,
        test_result: rows[0],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Database connection error:', error);
      res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: error.message,
        code: error.code,
        errno: error.errno,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Simple test-db route for easier access
  app.get('/api/test-db', async (req, res) => {
    try {
      const mysql = await import('mysql2/promise');
      
      const connectionConfig = {
        host: 'localhost',
        port: 3306,
        user: 'cybaemtech_Agile',
        password: 'Agile@9090$',
        database: 'cybaemtech_Agile'
      };
      
      console.log('Testing MySQL connection with config:', {
        host: connectionConfig.host,
        port: connectionConfig.port,
        user: connectionConfig.user,
        database: connectionConfig.database
      });
      
      const connection = await mysql.createConnection(connectionConfig);
      const [rows] = await connection.execute('SELECT 1 as test, NOW() as current_time, DATABASE() as db_name, VERSION() as mysql_version');
      await connection.end();
      
      res.json({
        success: true,
        message: 'MySQL database connection successful!',
        database: connectionConfig.database,
        test_result: rows[0],
        connection_info: {
          host: connectionConfig.host,
          port: connectionConfig.port,
          database: connectionConfig.database,
          user: connectionConfig.user
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Database connection error:', error);
      res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: error.message,
        code: error.code,
        errno: error.errno,
        connection_attempted: {
          host: 'localhost',
          port: 3306,
          database: 'cybaemtech_Agile',
          user: 'cybaemtech_Agile'
        },
        timestamp: new Date().toISOString()
      });
    }
  });
}