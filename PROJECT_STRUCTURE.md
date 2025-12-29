# Project Structure

## Agile Project Management System

### 📁 Root Directory
```
Agile_CybaemtechIn_13oct/
├── 📄 README.md                              # Main project documentation
├── 📄 PROTOTYPE_FLOW_DOCUMENTATION.md        # Complete system flow documentation
├── 📄 ACCESS_CONTROL_MATRIX.md               # User permissions and access control
├── 📄 DEPLOYMENT_GUIDE.md                    # Production deployment instructions
├── 📄 package.json                           # Node.js dependencies
├── 📄 package-lock.json                      # Locked dependency versions
├── 📄 tsconfig.json                          # TypeScript configuration
├── 📄 vite.config.ts                         # Vite build configuration
├── 📄 tailwind.config.ts                     # Tailwind CSS configuration
├── 📄 postcss.config.js                      # PostCSS configuration
├── 📄 components.json                        # Shadcn/ui components configuration
├── 📄 .env.example                           # Environment variables template
├── 📄 .gitignore                             # Git ignore patterns
└── 📄 database_schema.sql                    # Database structure
```

### 📁 Frontend (`/client`)
```
client/
├── 📄 index.html                             # Main HTML template
└── src/
    ├── 📄 main.tsx                           # React app entry point
    ├── 📁 components/                        # Reusable UI components
    │   ├── 📁 layout/
    │   │   ├── 📄 header.tsx                 # Top navigation header
    │   │   └── 📄 sidebar.tsx                # Left navigation sidebar
    │   ├── 📁 ui/                           # Base UI components
    │   │   ├── 📄 kanban-board.tsx           # Drag-drop board component
    │   │   ├── 📄 timeline-view.tsx          # Project timeline view
    │   │   ├── 📄 project-calendar.tsx       # Calendar view component
    │   │   └── 📄 ...                        # Other UI components
    │   ├── 📁 modals/                       # Modal dialogs
    │   │   ├── 📄 create-item-modal.tsx      # Create work item modal
    │   │   ├── 📄 edit-item-modal.tsx        # Edit work item modal
    │   │   └── 📄 ...                        # Other modals
    │   └── 📁 projects/                     # Project-specific components
    │       ├── 📄 project-card.tsx           # Project display card
    │       └── 📄 create-project.tsx         # Project creation form
    ├── 📁 pages/                            # Main application pages
    │   ├── 📄 login.tsx                      # User authentication
    │   ├── 📄 dashboard.tsx                  # Main dashboard
    │   ├── 📄 teams.tsx                      # Team management
    │   ├── 📄 projects.tsx                   # Project listing
    │   ├── 📄 project-details.tsx            # Detailed project view
    │   ├── 📄 calendar.tsx                   # Global calendar view
    │   └── 📄 reports.tsx                    # Analytics and reports
    ├── 📁 hooks/                            # Custom React hooks
    │   ├── 📄 useAuth.tsx                    # Authentication hook
    │   ├── 📄 use-modal.tsx                  # Modal management hook
    │   └── 📄 use-toast.tsx                  # Notification hook
    ├── 📁 lib/                              # Utility libraries
    │   ├── 📄 api-config.ts                  # API configuration
    │   ├── 📄 utils.ts                       # General utilities
    │   ├── 📄 queryClient.ts                 # TanStack Query setup
    │   └── 📄 data-utils.ts                  # Data processing utilities
    └── 📁 assets/                           # Static assets
        └── 📄 cybaem-logo.png                # Company logo
```

### 📁 Backend (`/api`)
```
api/
├── 📄 index.php                             # Main API router
├── 📄 auth.php                              # Authentication endpoints
├── 📄 users.php                             # User management API
├── 📄 teams.php                             # Team management API
├── 📄 projects.php                          # Project management API
├── 📄 work-items.php                        # Work item CRUD operations
├── 📄 project-bug-reports.php               # Bug reporting system
├── 📁 config/                               # Configuration files
│   └── 📄 database.php                      # Database connection
└── 📁 data/                                # Data processing utilities
    └── 📄 ...                               # Helper functions
```

### 📁 Database (`/database`)
```
Database Files:
├── 📄 database_schema.sql                   # Complete database structure
├── 📄 database_migration_*.sql              # Schema migration files
└── 📄 database_password_reset_migration.sql # Password reset functionality
```

### 📁 Shared (`/shared`)
```
shared/
└── 📄 schema.ts                             # TypeScript type definitions
```

### 📁 Documentation Files
```
Documentation:
├── 📄 ACCESS_CONTROL_IMPLEMENTATION.md      # Access control details
├── 📄 COMPLETE_INVITE_SYSTEM.md             # User invitation system
├── 📄 PASSWORD_RESET_SYSTEM.md              # Password reset functionality
├── 📄 TEAM_MEMBER_ROLE_UPDATE_FIX.md        # Role management fixes
├── 📄 PROJECT_CREATION_FIX.md               # Project creation improvements
├── 📄 SCREENSHOT_FEATURE_DOCS.md            # Screenshot functionality
├── 📄 EMAIL_INVITATION_FIX.md               # Email invitation system
├── 📄 LOGOUT_FIX.md                         # Logout functionality fixes
├── 📄 CURRENCY_FIX.md                       # Currency handling fixes
└── 📄 LOCAL_SETUP.md                        # Local development setup
```

### 📁 Generated Files (Build Output)
```
Build Output:
├── 📁 dist/                                # Production build output
├── 📁 node_modules/                        # Node.js dependencies
└── 📁 uploads/                             # User uploaded files
```

## Key Technologies Used

### Frontend Stack
- **React 18**: Modern UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **TailwindCSS**: Utility-first CSS framework
- **Wouter**: Lightweight routing
- **TanStack Query**: Server state management
- **Lucide Icons**: Modern icon library
- **Shadcn/ui**: High-quality component library

### Backend Stack
- **PHP 8+**: Server-side language
- **MySQL/MariaDB**: Relational database
- **REST API**: Simple HTTP API design
- **Session Authentication**: Secure user sessions

### Development Tools
- **Vite**: Development server and build tool
- **PostCSS**: CSS processing
- **ESLint**: Code linting
- **TypeScript**: Static type checking
- **Git**: Version control

## Feature Overview

### ✅ Completed Features
- User authentication and authorization
- Role-based access control
- Team management with hierarchical roles
- Project creation and management
- Work item hierarchy (EPIC → FEATURE → STORY → TASK/BUG)
- Kanban board with drag-and-drop
- List view with filtering and sorting
- Calendar view for deadline tracking
- Timeline/Gantt view for project planning
- Responsive design for mobile devices
- Bug reporting system
- Change password functionality
- User profile management

### 🎯 Access Control Features
- **Admin**: Full system access
- **Scrum Master**: Project-level management
- **Project Manager**: Project oversight
- **Team Lead**: Team coordination
- **Member**: Standard work item access
- **Viewer**: Read-only access
- **Creator/Assignee**: Edit own/assigned items

### 🔐 Security Features
- Secure password hashing
- SQL injection prevention
- XSS protection
- CSRF protection
- Session security
- Role-based permissions
- Resource-level access control

### 📱 User Experience
- Modern, clean interface
- Intuitive navigation
- Real-time updates
- Loading states and error handling
- Mobile-responsive design
- Keyboard shortcuts
- Toast notifications
- Modal dialogs

## Getting Started

### Quick Start
1. **Install dependencies**: `npm install`
2. **Setup database**: Import `database_schema.sql`
3. **Configure environment**: Copy `.env.example` to `.env`
4. **Start development**: `npm run dev`
5. **Access application**: http://localhost:5173

### Production Deployment
1. **Build application**: `npm run build`
2. **Deploy to server**: Copy `dist/` and `api/` directories
3. **Configure database**: Update connection settings
4. **Setup web server**: Apache/Nginx configuration
5. **Enable HTTPS**: SSL certificate setup

## Support

For detailed information, refer to:
- `PROTOTYPE_FLOW_DOCUMENTATION.md` - Complete system overview
- `ACCESS_CONTROL_MATRIX.md` - Permission reference
- `DEPLOYMENT_GUIDE.md` - Production setup guide
- Individual documentation files for specific features

---

*This project structure represents a complete agile project management system ready for production deployment.*