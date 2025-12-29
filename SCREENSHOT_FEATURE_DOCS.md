# Bug Report Screenshot Feature

This document outlines the implementation of screenshot upload functionality for bug reports.

## Features Added

### Frontend Changes
- Added file upload input with drag-and-drop styling
- Image preview functionality before submission
- File validation (type and size checking)
- Support for JPEG, PNG, and GIF formats
- Maximum file size of 5MB
- Screenshot display in bug reports table
- Click to view full-size image

### Backend Changes
- Modified `project-bug-reports.php` to handle file uploads
- Added `screenshot_path` column to database
- File validation on server side
- Automatic file cleanup when reports are deleted
- Unique filename generation to prevent conflicts

### Database Changes
- Added `screenshot_path` VARCHAR(500) column to `project_bug_reports` table
- Added database index for performance

## Usage

1. **Submitting a Bug Report with Screenshot:**
   - Fill in the bug description
   - Click the upload area or camera icon
   - Select an image file (JPEG, PNG, or GIF)
   - Preview will appear showing the selected image
   - Submit the form

2. **Viewing Screenshots:**
   - Screenshots appear as thumbnails in the bug reports table
   - Click any thumbnail to view the full-size image in a new tab

3. **File Requirements:**
   - Supported formats: JPEG, PNG, GIF
   - Maximum file size: 5MB
   - Files are stored in `/uploads/bug-screenshots/`

## Technical Implementation

### File Storage
- Files are stored in `/uploads/bug-screenshots/` directory
- Filenames are generated as: `bug_{timestamp}_{unique_id}.{extension}`
- Directory is created automatically if it doesn't exist

### Security Features
- File type validation on both frontend and backend
- File size limits enforced
- Unique filename generation prevents conflicts
- Files are cleaned up when bug reports are deleted

### Database Schema
```sql
ALTER TABLE project_bug_reports 
ADD COLUMN screenshot_path VARCHAR(500) NULL 
AFTER resolution_status;
```

## API Changes

### POST /project-bug-reports.php
Now accepts both JSON and FormData:
- JSON: For text-only bug reports (existing functionality)
- FormData: For bug reports with screenshots

### GET /project-bug-reports.php
Now includes `screenshot_path` in the response

### DELETE /project-bug-reports.php
Now removes associated screenshot files when deleting reports

## File Permissions
Ensure the uploads directory has proper write permissions:
```bash
chmod 755 uploads/
chmod 755 uploads/bug-screenshots/
```

## Deployment Notes
1. Run the database migration: `database_add_screenshot_column.sql`
2. Ensure uploads directory exists and has write permissions
3. Configure web server to serve static files from uploads directory
4. Consider implementing additional security measures for file uploads in production