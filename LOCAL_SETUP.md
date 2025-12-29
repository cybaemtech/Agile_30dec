# Local XAMPP Development Setup

## Quick Setup Instructions

### 1. Start XAMPP Services
- Start **Apache** and **MySQL** services in XAMPP Control Panel
- Ensure MySQL is running on port 3306

### 2. Create Database
Open phpMyAdmin (http://localhost/phpmyadmin) and run this SQL:

```sql
-- Copy and paste the entire contents of setup-local-db.sql file
-- OR simply import the setup-local-db.sql file through phpMyAdmin interface
```

**Alternative**: Import the `setup-local-db.sql` file directly in phpMyAdmin.

### 3. Configure Environment
The application will automatically detect local development and use:
- **Database**: `agile_tracker` on localhost:3306
- **User**: `root` (no password - default XAMPP setup)

### 4. Run Application
```bash
npm run dev
```

The application will:
✅ Auto-detect local XAMPP environment  
✅ Create database if it doesn't exist  
✅ Connect to MySQL localhost:3306  
✅ Start on http://localhost:5000  

### 5. Login Credentials
- **Admin**: admin@example.com / admin123
- **Scrum Master**: scrum@example.com / scrum123  
- **User**: user@example.com / user123

### Troubleshooting

**MySQL Connection Issues:**
- Ensure XAMPP MySQL service is running
- Check that no other MySQL service is using port 3306
- Verify root user has no password (default XAMPP setup)

**Database Issues:**
- If tables don't exist, import `setup-local-db.sql` in phpMyAdmin
- Clear browser cache if you see old data

**Port Issues:**
- If port 5000 is busy, the app will show an error
- Stop other applications using port 5000

### Environment Detection
The app automatically detects:
- **Local**: Uses `mysql://root:@localhost:3306/agile_tracker`  
- **Production**: Uses the remote cPanel MySQL server

No manual configuration needed!