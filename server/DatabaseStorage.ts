import { eq, and, desc, asc, isNull, sql } from "drizzle-orm";
import { db } from "./db";

import {
  users,
  teams,
  teamMembers,
  projects,
  workItems,
  comments,
  attachments,
  workItemHistory,
  type User,
  type InsertUser,
  type Team,
  type InsertTeam,
  type TeamMember,
  type InsertTeamMember,
  type Project,
  type InsertProject,
  type WorkItem,
  type InsertWorkItem,
  type Comment,
  type InsertComment,
  type Attachment,
  type InsertAttachment,
} from "@shared/schema";

/**
 * Generate external ID for work items using project key and an incremented counter
 */
async function generateExternalId(type: string, projectId: number): Promise<string> {
  if (!db) {
    throw new Error('Database not available');
  }
  
  // First, get the project key
  const [project] = await db
    .select({ key: projects.key })
    .from(projects)
    .where(eq(projects.id, projectId));
  
  if (!project) {
    throw new Error(`Project with ID ${projectId} not found`);
  }
  
  // Count existing work items for this project to generate the next sequence number
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(workItems)
    .where(eq(workItems.projectId, projectId));
  
  const count = countResult[0]?.count || 0;
  const nextNumber = count + 1;
  
  // Format to ensure at least 3 digits, e.g., PROJ-001
  return `${project.key}-${nextNumber.toString().padStart(3, '0')}`;
}

export class DatabaseStorage {
  // User management methods
  async getUser(id: number): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) {
      throw new Error('Database not available');
    }
      const result = await db.insert(users).values({
        ...insertUser,
        isActive: true,
        updatedAt: new Date(),
      });
      return result[0];
  }

  async getUsers(): Promise<User[]> {
    if (!db) return [];
    return await db.select().from(users);
  }

  async getAllUsers(): Promise<User[]> {
    if (!db) return [];
    return await db.select().from(users);
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    if (!db) return undefined;
    await db.update(users).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(users.id, id));
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // Team management methods
  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    if (!db) {
      throw new Error('Database not available');
    }
    // Check if created_by user exists
    if (insertTeam.createdBy) {
      const [user] = await db.select().from(users).where(eq(users.id, Number(insertTeam.createdBy)));
      if (!user) {
        throw new Error(`Cannot create team: created_by user with id ${insertTeam.createdBy} does not exist.`);
      }
    }
      const result = await db.insert(teams).values({
        ...insertTeam,
        isActive: true,
        updatedAt: new Date(),
      });
      return result[0];
  }

  async getTeam(id: number): Promise<Team | undefined> {
    if (!db) return undefined;
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async getTeams(): Promise<Team[]> {
    if (!db) return [];
    return await db.select().from(teams).where(eq(teams.isActive, true));
  }

  async getTeamsByUser(userId: number): Promise<Team[]> {
    if (!db) return [];
    // Find all teams where the user is a member
    return await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        createdBy: teams.createdBy,
        isActive: teams.isActive,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
      })
      .from(teams)
      .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(and(
        eq(teamMembers.userId, userId),
        eq(teams.isActive, true)
      ));
  }

  async deleteTeam(id: number): Promise<boolean> {
    if (!db) return false;
    
    try {
      // Start a transaction
      const result = await db.transaction(async (tx) => {
        // First, remove all team members (foreign key constraint)
        await tx.delete(teamMembers).where(eq(teamMembers.teamId, id));
        
        // Then delete the team
        const deleteResult = await tx.delete(teams).where(eq(teams.id, id));
        
        return Number(deleteResult[0].affectedRows) > 0;
      });
      
      return result;
    } catch (error) {
      console.error("Error deleting team:", error);
      return false;
    }
  }

  // Team members methods
  async addTeamMember(insertTeamMember: InsertTeamMember): Promise<TeamMember> {
    if (!db) {
      throw new Error('Database not available');
    }
      const result = await db.insert(teamMembers).values({
        ...insertTeamMember,
        updatedAt: new Date(),
      });
      return result[0];
  }

  async getTeamMembers(teamId: number): Promise<TeamMember[]> {
    if (!db) return [];
    return await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
  }

  async removeTeamMember(teamId: number, userId: number): Promise<boolean> {
    if (!db) return false;
    const result = await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        )
      );
    
    return Number(result[0].affectedRows) > 0;
  }

  // Project management methods
  async createProject(insertProject: InsertProject): Promise<Project> {
    if (!db) {
      throw new Error('Database not available');
    }
    // Ensure the correct column name 'key' is used for the project key
    const { key, ...rest } = insertProject as any;
    const result = await db.insert(projects).values({
      key: key, // always use 'key' for the project key column
      ...rest,
      updatedAt: new Date(),
    });
    const insertId = Number(result[0].insertId);
    const [project] = await db.select().from(projects).where(eq(projects.id, insertId));
    return project;
  }

  async getProject(id: number): Promise<Project | undefined> {
    if (!db) return undefined;
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjects(): Promise<Project[]> {
    if (!db) return [];
    return await db
      .select()
      .from(projects);
  }

  async getProjectsByTeam(teamId: number): Promise<Project[]> {
    if (!db) return [];
    return await db
      .select()
      .from(projects)
      .where(eq(projects.teamId, teamId));
  }
  
  async updateProject(id: number, updates: Partial<Project>): Promise<Project | undefined> {
    if (!db) return undefined;
    try {
      await db
        .update(projects)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(projects.id, id));
      
      // MySQL doesn't support RETURNING, so fetch the updated record
      return await this.getProject(id);
    } catch (error) {
      console.error("Error updating project:", error);
      return undefined;
    }
  }
  
  async deleteProject(id: number): Promise<boolean> {
    if (!db) return false;
    try {
      // In a real application, we might want to implement soft delete
      // or check for dependencies before deleting
      const result = await db
        .delete(projects)
        .where(eq(projects.id, id));
      
      return Number(result[0].affectedRows) > 0;
    } catch (error) {
      console.error("Error deleting project:", error);
      return false;
    }
  }

  // Work items methods (Epics, Features, Stories, Tasks, Bugs)
  async createWorkItem(insertWorkItem: InsertWorkItem): Promise<WorkItem> {
    if (!db) {
      throw new Error('Database not available');
    }
    // Generate external ID if not provided
    const externalId = insertWorkItem.externalId || 
                      await generateExternalId(insertWorkItem.type, insertWorkItem.projectId);
    
    // Populate createdByName and createdByEmail from reporter user if available
    let createdByName = insertWorkItem.createdByName;
    let createdByEmail = insertWorkItem.createdByEmail;
    
    if (insertWorkItem.reporterId && !createdByName) {
      const [reporter] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, insertWorkItem.reporterId));
      
      if (reporter) {
        createdByName = reporter.name;
        createdByEmail = reporter.email;
      }
    }
    
    // Log screenshot data for debugging
    console.log('Creating work item with screenshot:', {
      screenshot: insertWorkItem.screenshot ? 'present' : 'null',
      screenshotPath: insertWorkItem.screenshotPath
    });
    
    const result = await db.insert(workItems).values({
      ...insertWorkItem,
      externalId,
      createdByName,
      createdByEmail,
      actualHours: insertWorkItem.actualHours !== undefined && insertWorkItem.actualHours !== null && insertWorkItem.actualHours !== '' ? Number(insertWorkItem.actualHours) : null,
      screenshot: null, // Don't store in screenshot column
      screenshotBlob: insertWorkItem.screenshot || null, // Store in screenshot_blob column
      screenshotPath: insertWorkItem.screenshotPath || null,
      updatedAt: new Date(),
    });
    const insertId = Number(result[0].insertId);
    const [workItem] = await db.select().from(workItems).where(eq(workItems.id, insertId));

    // If it has a parent, trigger rollup for the parent
    if (workItem.parentId) {
      await this.calculateHierarchyHours(workItem.parentId);
    }

    return workItem;
  }

  async getWorkItem(id: number): Promise<WorkItem | undefined> {
    if (!db) return undefined;
    const [workItem] = await db.select().from(workItems).where(eq(workItems.id, id));
    if (!workItem) return undefined;

    // Backend Transformation: Map snake_case database columns to camelCase frontend properties
    return {
      ...workItem,
      currentBehavior: workItem.current_behavior,
      expectedBehavior: workItem.expected_behavior,
      bugType: workItem.bug_type,
      referenceUrl: workItem.reference_url,
      screenshotBlob: workItem.screenshot_blob,
      screenshotPath: workItem.screenshot_path,
    } as any;
  }

  async getAllWorkItems(): Promise<WorkItem[]> {
    if (!db) return [];
    const items = await db
      .select()
      .from(workItems)
      .orderBy(desc(workItems.updatedAt));
    
    return items.map(item => ({
      ...item,
      currentBehavior: item.current_behavior,
      expectedBehavior: item.expected_behavior,
      bugType: item.bug_type,
      referenceUrl: item.reference_url,
      screenshotBlob: item.screenshot_blob,
      screenshotPath: item.screenshot_path,
    })) as any;
  }

  async getWorkItemsByProject(projectId: number): Promise<WorkItem[]> {
    if (!db) return [];
    const items = await db
      .select()
      .from(workItems)
      .where(eq(workItems.projectId, projectId))
      .orderBy(desc(workItems.updatedAt));

    return items.map(item => ({
      ...item,
      currentBehavior: item.current_behavior,
      expectedBehavior: item.expected_behavior,
      bugType: item.bug_type,
      referenceUrl: item.reference_url,
      screenshotBlob: item.screenshot_blob,
      screenshotPath: item.screenshot_path,
    })) as any;
  }

  async getWorkItemsByParent(parentId: number): Promise<WorkItem[]> {
    if (!db) return [];
    const items = await db
      .select()
      .from(workItems)
      .where(eq(workItems.parentId, parentId))
      .orderBy(desc(workItems.updatedAt));

    return items.map(item => ({
      ...item,
      currentBehavior: item.current_behavior,
      expectedBehavior: item.expected_behavior,
      bugType: item.bug_type,
      referenceUrl: item.reference_url,
      screenshotBlob: item.screenshot_blob,
      screenshotPath: item.screenshot_path,
    })) as any;
  }

  async updateWorkItemStatus(id: number, status: string): Promise<WorkItem | undefined> {
    if (!db) return undefined;
    const now = new Date();
    const workItem = await this.getWorkItem(id);
    if (!workItem) return undefined;

    const values: Record<string, any> = {
      status,
      updatedAt: now,
    };
    
    // If status is DONE, set completedAt
    if (status === "DONE") {
      values.completedAt = now;
      // If it's a TASK or BUG, fill actualHours with estimate if not already set
      if ((workItem.type === 'TASK' || workItem.type === 'BUG') && (!workItem.actualHours || Number(workItem.actualHours) === 0) && workItem.estimate) {
        values.actualHours = Number(workItem.estimate);
      }
    }
    
    await db
      .update(workItems)
      .set(values)
      .where(eq(workItems.id, id));
    
    const updatedItem = await this.getWorkItem(id);
    
    // If actualHours was updated, trigger rollup
    if (values.actualHours && updatedItem?.parentId) {
      await this.calculateHierarchyHours(updatedItem.parentId);
    }
    
    return updatedItem;
  }

  async updateWorkItem(id: number, updates: Partial<WorkItem>): Promise<WorkItem | undefined> {
    if (!db) return undefined;
    
    // Process date fields to ensure they're proper Date objects
    const processedUpdates: any = { ...updates };
    
    // Handle startDate and endDate specifically
    if (updates.startDate && !(updates.startDate instanceof Date)) {
      try {
        processedUpdates.startDate = new Date(updates.startDate);
      } catch (error) {
        processedUpdates.startDate = null;
      }
    }
    
    if (updates.endDate && !(updates.endDate instanceof Date)) {
      try {
        processedUpdates.endDate = new Date(updates.endDate);
      } catch (error) {
        processedUpdates.endDate = null;
      }
    }

    // Map camelCase to snake_case for database updates if they come from frontend
    if (updates.currentBehavior !== undefined) processedUpdates.current_behavior = updates.currentBehavior;
    if (updates.expectedBehavior !== undefined) processedUpdates.expected_behavior = updates.expectedBehavior;
    if (updates.bugType !== undefined) processedUpdates.bug_type = updates.bugType;
    if (updates.referenceUrl !== undefined) processedUpdates.reference_url = updates.referenceUrl;
    if (updates.screenshotBlob !== undefined) processedUpdates.screenshot_blob = updates.screenshotBlob;
    
    // Remove the camelCase versions before sending to DB to avoid potential errors if they aren't in schema
    // Though Drizzle usually ignores unknown keys, being explicit is safer
    
    await db
      .update(workItems)
      .set({
        ...processedUpdates,
        updatedAt: new Date(),
      })
      .where(eq(workItems.id, id));
    
    // After update, if the item has a parent, trigger calculation up the hierarchy
    const updatedItem = await this.getWorkItem(id);
    if (updatedItem?.parentId) {
      await this.calculateHierarchyHours(updatedItem.parentId);
    }
    
    return updatedItem;
  }

  /**
   * Recursively calculate and update hours for parents in the hierarchy
   */
  private async calculateHierarchyHours(parentId: number): Promise<void> {
    if (!db) return;

    const parent = await this.getWorkItem(parentId);
    if (!parent) return;

    // Only auto-calculate for STORY, FEATURE, EPIC
    if (!['STORY', 'FEATURE', 'EPIC'].includes(parent.type)) return;

    // Get all children
    const children = await db.select().from(workItems).where(eq(workItems.parentId, parentId));

    let totalEstimate = 0;
    let totalActual = 0;

    for (const child of children) {
      totalEstimate += Number(child.estimate || 0);
      totalActual += Number(child.actualHours || 0);
    }

    // Update parent
    await db
      .update(workItems)
      .set({
        estimate: totalEstimate.toString(),
        actualHours: totalActual.toString(),
        updatedAt: new Date()
      })
      .where(eq(workItems.id, parentId));

    // Recursively update next level
    if (parent.parentId) {
      await this.calculateHierarchyHours(parent.parentId);
    }
  }

  async deleteWorkItem(id: number): Promise<boolean> {
    if (!db) return false;
    // Check if there are any child items first
    const childItems = await this.getWorkItemsByParent(id);
    if (childItems.length > 0) {
      return false; // Cannot delete if there are child items
    }
    
    const result = await db
      .delete(workItems)
      .where(eq(workItems.id, id));
    
    return Number(result[0].affectedRows) > 0;
  }
  
  // Comments methods
  async createComment(workItemId: number, userId: number, content: string): Promise<Comment> {
    if (!db) {
      throw new Error('Database not available');
    }
    const result = await db.insert(comments).values({
      workItemId,
      userId,
      content,
      updatedAt: new Date(),
    });
    
    // MySQL doesn't support RETURNING, so fetch the created record
    const insertId = Number(result[0].insertId);
    const [comment] = await db.select().from(comments).where(eq(comments.id, insertId));
    return comment;
  }
  
  async getCommentsByWorkItem(workItemId: number): Promise<Comment[]> {
    if (!db) return [];
    return await db
      .select()
      .from(comments)
      .where(eq(comments.workItemId, workItemId))
      .orderBy(asc(comments.createdAt));
  }

  // Work item history methods
  async addWorkItemHistoryEntry(
    workItemId: number, 
    userId: number, 
    field: string, 
    oldValue: string | null, 
    newValue: string | null
  ): Promise<void> {
    if (!db) return;
    await db.insert(workItemHistory).values({
      workItemId,
      userId,
      fieldName: field, // Use 'fieldName' as per schema
      oldValue,
      newValue,
      changeType: 'UPDATED', // Required field as per schema
    });
  }
  
  async getWorkItemHistory(workItemId: number): Promise<any[]> {
    if (!db) return [];
    return await db
      .select({
        id: workItemHistory.id,
        field: workItemHistory.fieldName, // Use 'fieldName' as per schema
        oldValue: workItemHistory.oldValue,
        newValue: workItemHistory.newValue,
        changedAt: workItemHistory.createdAt, // Use 'createdAt' as per schema
        userId: workItemHistory.userId,
        username: users.username,
        fullName: users.fullName,
      })
      .from(workItemHistory)
      .innerJoin(users, eq(workItemHistory.userId, users.id))
      .where(eq(workItemHistory.workItemId, workItemId))
      .orderBy(desc(workItemHistory.createdAt)); // Use 'createdAt' as per schema
  }
  
  // File attachments methods
  async addAttachment(attachment: InsertAttachment): Promise<Attachment> {
    if (!db) {
      throw new Error('Database not available');
    }
    const result = await db.insert(attachments).values(attachment);
    // MySQL doesn't support RETURNING, so fetch the created record
    const insertId = Number(result[0].insertId);
    const [attachment_result] = await db.select().from(attachments).where(eq(attachments.id, insertId));
    return attachment_result;
  }
  
  async getAttachmentsByWorkItem(workItemId: number): Promise<Attachment[]> {
    if (!db) return [];
    return await db
      .select()
      .from(attachments)
      .where(eq(attachments.workItemId, workItemId))
      .orderBy(desc(attachments.createdAt)); // Use 'createdAt' as per schema
  }
  
  // Advanced queries
  async getWorkItemsWithFilters(filters: {
    projectId?: number;
    types?: string[];
    statuses?: string[];
    priorities?: string[];
    assigneeId?: number | null; // null means unassigned
  }): Promise<WorkItem[]> {
    if (!db) return [];
    
    let conditions: any[] = [];
    
    if (filters.projectId !== undefined) {
      conditions.push(eq(workItems.projectId, filters.projectId));
    }
    
    if (filters.types && filters.types.length > 0) {
      conditions.push(sql`${workItems.type} IN (${filters.types.map(t => `'${t}'`).join(',')})`);
    }
    
    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(sql`${workItems.status} IN (${filters.statuses.map(s => `'${s}'`).join(',')})`);
    }

    return await db
      .select()
      .from(workItems)
      .where(and(...conditions))
      .orderBy(desc(workItems.updatedAt));
  }
  
  // Dashboard/reporting methods
  async getWorkItemsCountByStatus(projectId: number): Promise<Record<string, number>> {
    if (!db) return {};
    const results = await db
      .select({
        status: workItems.status,
        count: sql<number>`count(*)`,
      })
      .from(workItems)
      .where(eq(workItems.projectId, projectId))
      .groupBy(workItems.status);
    
    return results.reduce((acc: Record<string, number>, curr: any) => {
      acc[curr.status] = curr.count;
      return acc;
    }, {} as Record<string, number>);
  }
  
  async getWorkItemsCountByType(projectId: number): Promise<Record<string, number>> {
    if (!db) return {};
    const results = await db
      .select({
        type: workItems.type,
        count: sql<number>`count(*)`,
      })
      .from(workItems)
      .where(eq(workItems.projectId, projectId))
      .groupBy(workItems.type);
    
    return results.reduce((acc: Record<string, number>, curr: any) => {
      acc[curr.type] = curr.count;
      return acc;
    }, {} as Record<string, number>);
  }

  async getWorkItemsCountByPriority(projectId: number): Promise<Record<string, number>> {
    if (!db) return {};
    const results = await db
      .select({
        priority: workItems.priority,
        count: sql<number>`count(*)`,
      })
      .from(workItems)
      .where(eq(workItems.projectId, projectId))
      .groupBy(workItems.priority);
    
    return results.reduce((acc: Record<string, number>, curr: any) => {
      acc[curr.priority] = curr.count;
      return acc;
    }, {} as Record<string, number>);
  }
}