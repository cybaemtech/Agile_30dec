# Deployment Guide

## Prerequisites

### Server Requirements
- **Web Server**: Apache 2.4+ or Nginx 1.18+
- **PHP**: 8.0 or higher with extensions:
  - mysqli or PDO_MYSQL
  - json
  - session
  - curl
- **Database**: MySQL 8.0+ or MariaDB 10.5+
- **Node.js**: 18+ (for building frontend)

## Local Development Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd Agile_CybaemtechIn_13oct
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
```sql
-- Create database
CREATE DATABASE agile_project_management;
USE agile_project_management;

-- Import schema
SOURCE database_schema.sql;
```

### 4. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

**Environment Variables:**
```env
# Database Configuration
DB_HOST=localhost
DB_NAME=agile_project_management
DB_USER=your_db_user
DB_PASS=your_db_password

# Application Settings
APP_URL=http://localhost:3000
API_URL=http://localhost:8000

# Session Configuration
SESSION_LIFETIME=1440
SESSION_SECURE=false
```

### 5. Start Development Servers

**Frontend (Vite):**
```bash
npm run dev
# Runs on http://localhost:5173
```

**Backend (PHP):**
```bash
php -S localhost:8000 -t .
# or use php-server.php
php php-server.php
```

## Production Deployment

### Option 1: Traditional Web Server

#### Step 1: Build Frontend
```bash
npm run build
# Creates dist/ directory with optimized assets
```

#### Step 2: Server Configuration

**Apache (.htaccess):**
```apache
RewriteEngine On

# Handle client-side routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_URI} !^/api/
RewriteRule . /index.html [L]

# API routing
RewriteCond %{REQUEST_URI} ^/api/(.*)$
RewriteRule ^api/(.*)$ /api/index.php [L]

# Security headers
Header always set X-Frame-Options DENY
Header always set X-Content-Type-Options nosniff
Header always set X-XSS-Protection "1; mode=block"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"

# Cache static assets
<FilesMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 month"
</FilesMatch>
```

**Nginx:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/html;
    index index.html;

    # Static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API endpoints
    location /api/ {
        try_files $uri $uri/ /api/index.php?$query_string;
    }

    # PHP processing
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.0-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Static file caching
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1M;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Step 3: File Structure
```
/var/www/html/
├── index.html          (from dist/)
├── assets/            (from dist/assets/)
├── api/               (PHP API files)
├── uploads/           (file uploads)
└── .htaccess         (Apache config)
```

#### Step 4: Database Configuration
```sql
-- Create production database
CREATE DATABASE agile_production;

-- Create database user
CREATE USER 'agile_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON agile_production.* TO 'agile_user'@'localhost';
FLUSH PRIVILEGES;

-- Import schema
USE agile_production;
SOURCE database_schema.sql;
```

#### Step 5: Environment Setup
```env
# Production Environment
DB_HOST=localhost
DB_NAME=agile_production
DB_USER=agile_user
DB_PASS=secure_password

APP_URL=https://your-domain.com
API_URL=https://your-domain.com

SESSION_LIFETIME=1440
SESSION_SECURE=true
SESSION_HTTPONLY=true
```

### Option 2: Docker Deployment

#### Create Dockerfile
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production image
FROM php:8.0-apache

# Install PHP extensions
RUN docker-php-ext-install mysqli pdo pdo_mysql

# Enable Apache modules
RUN a2enmod rewrite headers

# Copy application files
COPY --from=builder /app/dist/ /var/www/html/
COPY api/ /var/www/html/api/
COPY .htaccess /var/www/html/

# Set permissions
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

EXPOSE 80
```

#### Docker Compose
```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "80:80"
    volumes:
      - ./uploads:/var/www/html/uploads
    environment:
      - DB_HOST=db
      - DB_NAME=agile_db
      - DB_USER=agile_user
      - DB_PASS=agile_password
    depends_on:
      - db

  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: agile_db
      MYSQL_USER: agile_user
      MYSQL_PASSWORD: agile_password
      MYSQL_ROOT_PASSWORD: root_password
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database_schema.sql:/docker-entrypoint-initdb.d/schema.sql

volumes:
  mysql_data:
```

#### Deploy with Docker
```bash
docker-compose up -d
```

## SSL/HTTPS Setup

### Using Let's Encrypt (Certbot)
```bash
# Install certbot
sudo apt install certbot python3-certbot-apache

# Get certificate
sudo certbot --apache -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Manual SSL Configuration
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/private.key;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # ... rest of configuration
}
```

## Monitoring and Maintenance

### Health Checks
```bash
# Check database connection
curl http://your-domain.com/api/health

# Check application status
curl http://your-domain.com/api/status
```

### Backup Strategy
```bash
#!/bin/bash
# backup.sh

# Database backup
mysqldump -u agile_user -p agile_production > backup_$(date +%Y%m%d).sql

# File backup
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz /var/www/html/uploads

# Cleanup old backups (keep 30 days)
find /backups -name "*.sql" -mtime +30 -delete
find /backups -name "*.tar.gz" -mtime +30 -delete
```

### Log Monitoring
```bash
# Apache logs
tail -f /var/log/apache2/error.log
tail -f /var/log/apache2/access.log

# PHP logs
tail -f /var/log/php/error.log

# Application logs
tail -f /var/www/html/logs/application.log
```

## Performance Optimization

### Frontend Optimization
- Enable Gzip compression
- Use CDN for static assets
- Implement caching strategies
- Optimize images and fonts

### Backend Optimization
- Enable PHP OpCache
- Configure MySQL query cache
- Implement Redis for sessions
- Use connection pooling

### Database Optimization
```sql
-- Add indexes for performance
CREATE INDEX idx_work_items_project_id ON work_items(project_id);
CREATE INDEX idx_work_items_assignee_id ON work_items(assignee_id);
CREATE INDEX idx_work_items_reporter_id ON work_items(reporter_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
```

## Security Checklist

### Production Security
- [ ] Enable HTTPS with strong SSL configuration
- [ ] Update all default passwords
- [ ] Disable PHP error display
- [ ] Set secure session configuration
- [ ] Enable CSRF protection
- [ ] Configure proper file permissions
- [ ] Regular security updates
- [ ] Database access restrictions
- [ ] Web application firewall (WAF)
- [ ] Regular backups and disaster recovery testing

### File Permissions
```bash
# Set proper permissions
sudo chown -R www-data:www-data /var/www/html
sudo find /var/www/html -type d -exec chmod 755 {} \;
sudo find /var/www/html -type f -exec chmod 644 {} \;
sudo chmod -R 777 /var/www/html/uploads
```

## Troubleshooting

### Common Issues
1. **Database connection errors**: Check credentials and server status
2. **File upload failures**: Verify directory permissions
3. **Session issues**: Check session configuration
4. **API errors**: Review PHP error logs
5. **Build failures**: Check Node.js version and dependencies

### Debug Mode
```env
# Enable debug mode
DEBUG=true
LOG_LEVEL=debug
DISPLAY_ERRORS=true
```

---

*This deployment guide covers the essential steps for getting the application running in various environments. Adjust configurations based on your specific requirements and infrastructure.*