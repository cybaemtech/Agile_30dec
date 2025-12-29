import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { workItems } from "@shared/schema";

/**
 * Middleware to check if the current user has admin role
 */
export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  // Get the user ID from the session
  const userId = (req as any).session?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: Not logged in" });
  }
  
  try {
    // Get the user record to check role using storage interface
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }
    
    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    
    // User is an admin, proceed
    next();
  } catch (error) {
    console.error("Error in admin middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Middleware to check if the current user has Scrum Master role (or higher)
 */
export const isScrumMasterOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
  // Get the user ID from the session
  const userId = (req as any).session?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: Not logged in" });
  }
  
  try {
    // Get the user record to check role using storage interface
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }
    
    if (user.role !== "ADMIN" && user.role !== "SCRUM_MASTER") {
      return res.status(403).json({ message: "Forbidden: Scrum Master or Admin access required" });
    }
    
    // User is a Scrum Master or Admin, proceed
    next();
  } catch (error) {
    console.error("Error in scrum master middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Middleware to check if a user can manage work items of specific types
 * Used to implement role-based access control for work items
 * - Admin: Full access to all work item types (EPIC, FEATURE, STORY, TASK, BUG)
 * - Scrum Master: Can manage EPIC and FEATURE 
 * - Member: Can only create STORY, TASK, and BUG
 */
export const canManageWorkItemType = (allowedTypes: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // For PATCH requests, we don't need to check the type as strictly
    // since we're only updating existing items, not creating new ones
    const isUpdate = req.method === 'PATCH';
    const workItemType = req.body.type;
    
    // Only require type for POST (creation) requests
    if (!isUpdate && !workItemType) {
      return res.status(400).json({ message: "Work item type is required" });
    }
    
    // Get the user ID from the session
    const userId = (req as any).session?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: Not logged in" });
    }
    
    try {
      // Get the user record to check role using storage interface
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized: User not found" });
      }
      
      // Admin: Full access to all work item types
      if (user.role === "ADMIN") {
        return next();
      }
      
      // For PATCH requests, allow SCRUM_MASTER to update any work item
      // since they can manage projects
      if (isUpdate && user.role === "SCRUM_MASTER") {
        return next();
      }
      
      // Scrum Master: Can manage EPIC and FEATURE
      if (user.role === "SCRUM_MASTER") {
        if (workItemType && ["EPIC", "FEATURE"].includes(workItemType)) {
          return next();
        } else if (!isUpdate) {
          return res.status(403).json({ 
            message: "Scrum Masters can only create EPIC and FEATURE work items"
          });
        }
      }
      
      // For PATCH requests, allow regular users to update items they are assigned to
      // This will be further validated by the actual route logic
      if (isUpdate && user.role === "USER") {
        return next();
      }
      
      // Member (USER role): Can only create STORY, TASK, and BUG
      if (user.role === "USER") {
        if (workItemType && ["STORY", "TASK", "BUG"].includes(workItemType)) {
          return next();
        } else if (!isUpdate) {
          return res.status(403).json({ 
            message: "Regular users can only create STORY, TASK, and BUG work items"
          });
        }
      }
      
      // If role is not recognized, deny access
      return res.status(403).json({ 
        message: "Access denied: Invalid user role" 
      });
    } catch (error) {
      console.error("Error in work item type middleware:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
};

/**
 * Middleware to check if a user can delete a work item
 * Regular users cannot delete any work items
 * Scrum Masters can delete Story, Task, Bug
 * Admins can delete any work item
 */
export const canDeleteWorkItem = async (req: Request, res: Response, next: NextFunction) => {
  // Get the user ID from the session
  const userId = (req as any).session?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: Not logged in" });
  }
  
  try {
    // Get the user record to check role using storage interface
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }
    
    // If admin, allow deletion
    if (user.role === "ADMIN") {
      return next();
    }
    
    // For Scrum Master, we need to check the work item type
    if (user.role === "SCRUM_MASTER") {
      // Get the ID of the work item to be deleted
      const workItemId = parseInt(req.params.id);
      
      if (isNaN(workItemId)) {
        return res.status(400).json({ message: "Invalid work item ID" });
      }
      
      // Get the work item to check its type using storage interface
      const workItem = await storage.getWorkItem(workItemId);
      
      if (!workItem) {
        return res.status(404).json({ message: "Work item not found" });
      }
      
      // Scrum Masters can only delete STORY, TASK, BUG
      if (["STORY", "TASK", "BUG"].includes(workItem.type)) {
        return next();
      } else {
        return res.status(403).json({ 
          message: "Scrum Masters can only delete Stories, Tasks, and Bugs" 
        });
      }
    }
    
    // Regular users cannot delete any work items
    return res.status(403).json({ message: "Regular users cannot delete work items" });
    
  } catch (error) {
    console.error("Error in delete work item middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Middleware to check if a user can delete a project or team
 * Only Admins can delete projects and teams
 */
export const canDeleteEntity = async (req: Request, res: Response, next: NextFunction) => {
  // Get the user ID from the session
  const userId = (req as any).session?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: Not logged in" });
  }
  
  try {
    // Get the user record to check role using storage interface
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }
    
    // Only admins can delete projects and teams
    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only administrators can delete projects and teams" });
    }
    
    // User is an admin, proceed
    next();
  } catch (error) {
    console.error("Error in delete entity middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Middleware to check if a user can access a specific project
 * Only team members of the project's team can access the project
 */
export const canAccessProject = async (req: Request, res: Response, next: NextFunction) => {
  // Get the user ID from the session
  const userId = (req as any).session?.userId;
  const projectId = parseInt(req.params.id || req.params.projectId);
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: Not logged in" });
  }
  
  if (!projectId || isNaN(projectId)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }
  
  try {
    // Get the user record
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }
    
    // Admins can access any project
    if (user.role === "ADMIN") {
      return next();
    }
    
    // Get the project
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    // If project has no team assigned, only admin can access
    if (!project.teamId) {
      return res.status(403).json({ message: "Project access denied: No team assigned" });
    }
    
    // Check if user is a member of the project's team
    const teamMembers = await storage.getTeamMembers(project.teamId);
    const isTeamMember = teamMembers.some(member => member.userId === userId);
    
    if (!isTeamMember) {
      return res.status(403).json({ 
        message: "Project access denied: You must be a member of the assigned team" 
      });
    }
    
    // User is a team member, allow access
    next();
  } catch (error) {
    console.error("Error in project access middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};