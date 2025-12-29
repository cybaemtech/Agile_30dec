# Agile Project Management System

## Overview
A comprehensive agile project management application built with Express, React, and PostgreSQL. The system supports team collaboration, project tracking, and work item management with features like Epics, Stories, and Tasks.

## Project Architecture
- **Frontend**: React with Vite, Tailwind CSS, and Radix UI. Uses `wouter` for routing and `TanStack Query` for data fetching.
- **Backend**: Express.js server providing a RESTful API.
- **Database**: PostgreSQL with Drizzle ORM.
- **Session Management**: `express-session` with `connect-pg-simple` (PostgreSQL) or `memorystore` (in-memory fallback).
- **Authentication**: Passport.js with local strategy.

## Project Structure
- `client/`: React frontend application.
- `server/`: Express backend application.
- `shared/`: Shared schemas and types (Drizzle ORM).
- `attached_assets/`: Static assets and generated images.

## Recent Changes
- **2025-12-25**: Added "Manage Team - All Users" page with active/inactive tabs and card-based UI.
- **2025-12-25**: Fixed database connection to use Neon serverless and corrected build entry point.
- **2025-12-22**: Initialized project, installed `cross-env`, and verified session management setup.

## User Preferences
- **Frameworks**: React, Express, Drizzle ORM.
- **Styling**: Tailwind CSS, Lucide Icons.
- **Port**: Always bind frontend to 0.0.0.0:5000.
