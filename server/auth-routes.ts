import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { storage } from './storage';

const authRouter = Router();

// Login route - using MySQL database directly
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Get user from database
    const user = await storage.getUserByEmail(email);
    if (!user || !user.isActive) {
      console.log(`Login failed for ${email}: user not found or inactive`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`Attempting login for ${email}, hash starts with: ${user.password.substring(0, 10)}`);

    // Verify password - handle both bcrypt formats
    let passwordMatch = false;
    try {
      // Try standard bcrypt comparison
      passwordMatch = await bcrypt.compare(password, user.password);

      // If that fails and it's the Laravel default hash, try common passwords
      if (!passwordMatch && user.password === '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi') {
        // This is Laravel's default hash for 'password'
        passwordMatch = (password === 'password');
        console.log(`Laravel default hash detected, trying 'password': ${passwordMatch}`);
      }
    } catch (error) {
      console.log(`Password comparison error: ${error.message}`);
    }

    if (!passwordMatch) {
      console.log(`Login failed for ${email}: invalid password. Try 'password' if using Laravel hash.`);
      return res.status(401).json({
        message: 'Invalid credentials',
        hint: user.password.includes('$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
          ? 'Try password: password'
          : undefined
      });
    }

    // Set user in session
    (req.session as any).userId = user.id;
    (req.session as any).userRole = user.role;

    // Return success response
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout route
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Error logging out' });
      }
      res.clearCookie('AGILE_SESSION_ID');
      return res.status(200).json({ message: 'Logged out successfully' });
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Session refresh route
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Touch the session to refresh it
    req.session.touch();
    
    // Update session expiry
    const sessionExpiry = Date.now() + (8 * 60 * 60 * 1000); // 8 hours from now
    
    return res.status(200).json({
      success: true,
      message: 'Session refreshed',
      sessionExpiry
    });
  } catch (error) {
    console.error('Session refresh error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Check authentication status
authRouter.get('/status', async (req: Request, res: Response) => {
  try {
    if ((req.session as any)?.userId) {
      return res.status(200).json({
        authenticated: true,
        userRole: (req.session as any).userRole
      });
    } else {
      return res.status(200).json({ authenticated: false });
    }
  } catch (error) {
    console.error('Auth status error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user
authRouter.get('/user', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate session expiry
    const sessionExpiry = req.session.cookie.expires
      ? new Date(req.session.cookie.expires).getTime()
      : Date.now() + (req.session.cookie.maxAge || 8 * 60 * 60 * 1000);

    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      sessionExpiry
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Debug: List all users for troubleshooting
authRouter.get('/debug-users', async (req: Request, res: Response) => {
  try {
    const users = await storage.getUsers();
    const userList = users.map(user => ({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      passwordHash: user.password.substring(0, 20) + '...' // Show first 20 chars
    }));
    return res.json({
      totalUsers: users.length,
      users: userList,
      note: "If you manually inserted admin@company.com, the password is likely 'password'"
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ message: 'Error fetching users' });
  }
});

// Reset password for manually created admin user
authRouter.post('/reset-admin-password', async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and newPassword required' });
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // This is a simplified update - in a real app you'd need proper update method
    console.log(`Password reset requested for ${email} - implement storage.updateUser method`);

    return res.json({
      message: 'Password reset functionality noted',
      instruction: 'Use the database admin panel to update the password hash',
      newHash: hashedPassword
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({ message: 'Error resetting password' });
  }
});

// Create/reset admin users - for debugging login issues
authRouter.post('/setup-admin-users', async (req: Request, res: Response) => {
  try {
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);

    // Hash passwords
    const adminHashedPassword = await bcrypt.hash('admin123', salt);
    const scrumHashedPassword = await bcrypt.hash('scrum123', salt);

    // Check and create/update admin user
    let adminUser = await storage.getUserByEmail('admin@example.com');
    if (!adminUser) {
      adminUser = await storage.createUser({
        username: 'admin',
        email: 'admin@example.com',
        password: adminHashedPassword,
        fullName: 'Admin User',
        role: 'ADMIN',
        isActive: true
      });
      console.log('Created admin user');
    }

    // Check and create/update scrum user  
    let scrumUser = await storage.getUserByEmail('scrum@example.com');
    if (!scrumUser) {
      scrumUser = await storage.createUser({
        username: 'scrummaster',
        email: 'scrum@example.com',
        password: scrumHashedPassword,
        fullName: 'Scrum Master',
        role: 'SCRUM_MASTER',
        isActive: true
      });
      console.log('Created scrum user');
    }

    return res.status(200).json({
      message: 'Admin users setup complete',
      users: [
        { email: 'admin@example.com', password: 'admin123' },
        { email: 'scrum@example.com', password: 'scrum123' }
      ]
    });
  } catch (error) {
    console.error('Error setting up admin users:', error);
    return res.status(500).json({ message: 'Error setting up users' });
  }
});

export default authRouter;