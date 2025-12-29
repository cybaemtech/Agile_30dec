import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import {
  insertUserSchema,
  insertTeamSchema,
  insertTeamMemberSchema,
  insertProjectSchema,
  insertWorkItemSchema,
  emailSchema,
  users,
} from "@shared/schema";
import { ZodError, z } from "zod";
import {
  isAdmin,
  isScrumMasterOrAdmin,
  canManageWorkItemType,
  canDeleteEntity,
  canAccessProject,
} from "./auth-middleware";
import authRouter from "./auth-routes";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register auth routes
  app.use("/api/auth", authRouter);

  // User routes
  app.get("/api/users/all", async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithoutPasswords = allUsers.map((user) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/users/:id/status", async (req: any, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "ADMIN" && user.role !== "SCRUM_MASTER") {
      return res
        .status(403)
        .json({ message: "Not authorized to update user status" });
    }

    const { id } = req.params;
    const { isActive } = req.body;

    try {
      if (!db) {
        throw new Error("Database connection not available");
      }
      const [updatedUser] = await db
        .update(users)
        .set({ isActive })
        .where(eq(users.id, parseInt(id)))
        .returning();

      if (!updatedUser)
        return res.status(404).json({ message: "User not found" });
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // User profile update endpoint
  app.patch("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updates = req.body;
      const user = await storage.updateUser(userId, updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users", async (req: any, res) => {
    try {
      const userData = insertUserSchema.parse(req.body) as any;

      // Validate email is corporate
      try {
        emailSchema.parse(userData.email);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Only corporate email addresses are allowed" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "User with this email already exists" });
      }

      const user = await storage.createUser(userData);

      // Don't return password in response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      handleZodError(error, res);
    }
  });

  app.get("/api/users", async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Remove passwords from response
      const usersWithoutPasswords = allUsers.map((user) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user by email
  app.get("/api/users/by-email/:email", async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't return password in response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user by email:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't return password in response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user by id:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User invitation endpoint - creates user if not exists
  app.post("/api/users/invite", async (req, res) => {
    try {
      const { email, username, role } = req.body;

      // Validate email is corporate
      try {
        emailSchema.parse(email);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Only corporate email addresses are allowed" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        // Return existing user without password
        const { password, ...userWithoutPassword } = existingUser;
        return res.json(userWithoutPassword);
      }

      // Create new user with default password
      const userData = {
        email,
        username,
        fullName: username || email.split("@")[0], // Use username as default full name
        password: "defaultPassword123", // Default password for invited users
        role: role || "USER",
      };

      const user = await storage.createUser(userData);

      // Don't return password in response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error inviting user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Team routes
  // Create team (Admin only)
  app.post("/api/teams", isAdmin, async (req, res) => {
    try {
      const teamData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(teamData);
      res.status(201).json(team);
    } catch (error) {
      handleZodError(error, res);
    }
  });

  app.get("/api/teams", async (_req, res) => {
    try {
      const teams = await storage.getTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/teams/:id", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const team = await storage.getTeam(teamId);

      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      res.json(team);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete team (Admin only)
  app.delete("/api/teams/:id", canDeleteEntity, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);

      // Check if team exists
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      // Check if team has associated projects
      const projects = await storage.getProjectsByTeam(teamId);
      if (projects.length > 0) {
        return res.status(400).json({
          message: "Cannot delete team with associated projects",
          details: `This team has ${projects.length} project(s). Please reassign or delete the projects first.`,
        });
      }

      // Delete the team (this will also remove team members due to foreign key constraints)
      const deleted = await storage.deleteTeam(teamId);

      if (!deleted) {
        return res.status(404).json({ message: "Team not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:userId/teams", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const teams = await storage.getTeamsByUser(userId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching user teams:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Team members routes
  // Add team member (Admin and Scrum Master)
  app.post("/api/teams/:teamId/members", async (req: any, res) => {
    try {
      const teamId = parseInt(req.params.teamId);

      // Check if team exists
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      const memberData = insertTeamMemberSchema.parse({
        ...req.body,
        teamId,
      }) as any;

      // Validate if user exists
      const user = await storage.getUser(memberData.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const teamMember = await storage.addTeamMember(memberData);
      res.status(201).json(teamMember);
    } catch (error) {
      handleZodError(error, res);
    }
  });

  app.get("/api/teams/:teamId/members", async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);

      // Check if team exists
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      const members = await storage.getTeamMembers(teamId);

      // Get full user data for each member
      const memberDetails = await Promise.all(
        members.map(async (member) => {
          const user = await storage.getUser(member.userId);
          if (!user) return { ...member, user: null };

          // Remove password from user data
          const { password, ...userWithoutPassword } = user;
          return { ...member, user: userWithoutPassword };
        }),
      );

      res.json(memberDetails);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove team member (Admin and Scrum Master)
  app.delete(
    "/api/teams/:teamId/members/:userId",
    isScrumMasterOrAdmin,
    async (req, res) => {
      try {
        const teamId = parseInt(req.params.teamId);
        const userId = parseInt(req.params.userId);

        const removed = await storage.removeTeamMember(teamId, userId);

        if (!removed) {
          return res.status(404).json({ message: "Team member not found" });
        }

        res.status(204).send();
      } catch (error) {
        console.error("Error removing team member:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Get team members for a specific project (for assignee dropdown) - requires project access
  app.get(
    "/api/projects/:projectId/team-members",
    canAccessProject,
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);

        // Get the project to find its team
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        if (!project.teamId) {
          return res.json([]); // Return empty array if project has no team
        }

        // Get team members for the project's team
        const members = await storage.getTeamMembers(project.teamId);

        // Get full user data for each member
        const memberDetails = await Promise.all(
          members.map(async (member) => {
            const user = await storage.getUser(member.userId);
            if (!user) return null;

            // Remove password from user data
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
          }),
        );

        // Filter out null values and return users only
        const availableUsers = memberDetails.filter((user) => user !== null);
        res.json(availableUsers);
      } catch (error) {
        console.error("Error fetching project team members:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Project routes
  // Create project (Admin and Scrum Master only)
  app.post("/api/projects", isScrumMasterOrAdmin, async (req: any, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body) as any;

      // Validate if team exists (if teamId is provided)
      if (projectData.teamId) {
        const team = await storage.getTeam(projectData.teamId);
        if (!team) {
          return res.status(404).json({ message: "Team not found" });
        }
      }

      // Validate if user exists
      if (projectData.createdBy) {
        const user = await storage.getUser(projectData.createdBy);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
      }

      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      // Check for specific database errors
      if (error && typeof error === "object" && "code" in error) {
        // Handle unique constraint violation
        if ((error as any).code === "23505") {
          // Extract the duplicate field from the error detail
          const errorDetail = "detail" in error ? String((error as any).detail) : "";
          const duplicateMatch =
            /Key \((\w+)\)=\(([^)]+)\) already exists/.exec(errorDetail);
          if (duplicateMatch) {
            const [, field, value] = duplicateMatch;
            return res.status(409).json({
              message: `Conflict error`,
              errors: [
                {
                  path: field,
                  message: `The ${field} "${value}" is already taken`,
                },
              ],
            });
          }
        }
      }

      // Otherwise handle as standard validation error
      handleZodError(error, res);
    }
  });

  app.get("/api/projects", async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/projects/:id", canAccessProject, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/teams/:teamId/projects", async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);

      // Check if team exists
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      const projects = await storage.getProjectsByTeam(teamId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching team projects:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update a project (for archiving or other updates)
  // Update project (Admin and Scrum Master only)
  app.patch("/api/projects/:id", isScrumMasterOrAdmin, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);

      // Check if project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Update the project with the provided fields
      const updatedProject = await storage.updateProject(projectId, req.body);

      if (!updatedProject) {
        return res.status(400).json({ message: "Failed to update project" });
      }

      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a project (Admin only)
  app.delete("/api/projects/:id", canDeleteEntity, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);

      // Check if project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Delete the project
      const success = await storage.deleteProject(projectId);

      if (!success) {
        return res.status(400).json({ message: "Failed to delete project" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Work items routes (Epics, Features, Stories, Tasks, Bugs)
  // Create work item (Role-based access control)
  app.post("/api/work-items", canManageWorkItemType([]), async (req: any, res) => {
    try {
      const modifiedSchema = insertWorkItemSchema.extend({
        externalId: z.string().optional(),
      });

      const formData = req.body;
      const workItemData = (modifiedSchema.parse(formData)) as any;

      const project = await storage.getProject(workItemData.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (workItemData.parentId) {
        const parent = await storage.getWorkItem(workItemData.parentId);
        if (!parent) {
          return res.status(404).json({ message: "Parent work item not found" });
        }
      }

      const workItem = await storage.createWorkItem(workItemData);
      res.status(201).json(workItem);
    } catch (error) {
      handleZodError(error, res);
    }
  });

  const httpServer = createServer(app);

  // Error handling middleware for Zod validation errors
  const handleZodError = (error: unknown, res: Response) => {
    if (error instanceof ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      }));
      return res
        .status(400)
        .json({ message: "Validation error", errors: formattedErrors });
    }

    console.error("Unexpected error:", error);
    return res.status(500).json({ message: "Internal server error" });
  };

  return httpServer;
}

// Parent-child relationship validation
export function validateParentChildRelationship(parentType: string, childType: string): boolean {
  const allowedRelationships: Record<string, string[]> = {
    EPIC: ["FEATURE"],
    FEATURE: ["STORY", "BUG"],
    STORY: ["TASK", "BUG"],
    TASK: [],
    BUG: ["TASK"],
  };

  return allowedRelationships[parentType]?.includes(childType) || false;
}
