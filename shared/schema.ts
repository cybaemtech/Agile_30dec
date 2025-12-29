import { pgTable, text, varchar, integer, decimal, boolean, timestamp, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Enum options
const statusOptions = ['TODO', 'IN_PROGRESS', 'ON_HOLD', 'DONE'] as const;
const priorityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const itemTypeOptions = ['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG'] as const;
const roleOptions = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
const userRoleOptions = ['ADMIN', 'SCRUM_MASTER', 'USER'] as const;
const projectStatusOptions = ['PLANNING', 'ACTIVE', 'ARCHIVED', 'COMPLETED'] as const;
const projectCategoryOptions = ['CLIENT', 'IN_HOUSE'] as const;

// Enums for PostgreSQL
export const statusEnum = pgEnum("status", statusOptions);
export const priorityEnum = pgEnum("priority", priorityOptions);
export const itemTypeEnum = pgEnum("item_type", itemTypeOptions);
export const roleEnum = pgEnum("role", roleOptions);
export const userRoleEnum = pgEnum("user_role", userRoleOptions);
export const projectStatusEnum = pgEnum("project_status", projectStatusOptions);
export const projectCategoryEnum = pgEnum("project_category", projectCategoryOptions);

// Users table
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  password: varchar("password", { length: 100 }).notNull(),
  avatarUrl: varchar("avatar_url", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  role: userRoleEnum("user_role").notNull().default("USER"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    emailIdx: uniqueIndex("user_email_idx").on(table.email),
    usernameIdx: uniqueIndex("user_username_idx").on(table.username),
  };
});

// Teams table
export const teams = pgTable("teams", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    nameIdx: index("team_name_idx").on(table.name),
    createdByIdx: index("team_created_by_idx").on(table.createdBy),
  };
});

// TeamMembers junction table
export const teamMembers = pgTable("team_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: roleEnum("role").notNull().default("MEMBER"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    teamUserIdx: uniqueIndex("team_user_idx").on(table.teamId, table.userId),
    teamIdx: index("team_member_team_idx").on(table.teamId),
    userIdx: index("team_member_user_idx").on(table.userId),
  };
});

// Projects table
export const projects = pgTable("projects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: varchar("key", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: projectCategoryEnum("category").notNull().default("IN_HOUSE"),
  status: projectStatusEnum("status").notNull().default("ACTIVE"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdByName: varchar("createdByName", { length: 255 }),
  createdByEmail: varchar("createdByEmail", { length: 255 }),
  teamId: integer("team_id").references(() => teams.id, { onDelete: 'set null' }),
  startDate: timestamp("start_date"),
  targetDate: timestamp("target_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    nameIdx: index("project_name_idx").on(table.name),
    keyIdx: uniqueIndex("project_key_idx").on(table.key),
    teamIdx: index("project_team_idx").on(table.teamId),
    statusIdx: index("project_status_idx").on(table.status),
    categoryIdx: index("project_category_idx").on(table.category),
  };
});

// WorkItems table
export const workItems = pgTable("work_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  externalId: varchar("external_id", { length: 20 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  tags: text("tags"),
  type: itemTypeEnum("type").notNull(),
  status: statusEnum("status").notNull().default("TODO"),
  priority: priorityEnum("priority").default("MEDIUM"),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  parentId: integer("parent_id"),
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: 'set null' }),
  reporterId: integer("reporter_id").references(() => users.id, { onDelete: 'set null' }),
  createdByName: varchar("created_by_name", { length: 255 }),
  createdByEmail: varchar("created_by_email", { length: 255 }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: 'set null' }),
  updatedByName: varchar("updated_by_name", { length: 255 }),
  estimate: decimal("estimate", { precision: 10, scale: 2 }),
  actualHours: decimal("actual_hours", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  completedAt: timestamp("completed_at"),
  // Bug-specific fields
  bugType: varchar("bug_type", { length: 50 }),
  severity: varchar("severity", { length: 50 }),
  currentBehavior: text("current_behavior"),
  expectedBehavior: text("expected_behavior"),
  referenceUrl: varchar("reference_url", { length: 500 }),
  screenshotPath: varchar("screenshot_path", { length: 500 }),
  screenshot: text("screenshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    externalIdIdx: uniqueIndex("work_item_external_id_idx").on(table.externalId),
    projectIdx: index("work_item_project_idx").on(table.projectId),
    parentIdx: index("work_item_parent_idx").on(table.parentId),
    assigneeIdx: index("work_item_assignee_idx").on(table.assigneeId),
    reporterIdx: index("work_item_reporter_idx").on(table.reporterId),
    updatedByIdx: index("work_item_updated_by_idx").on(table.updatedBy),
  };
});

// Comments table
export const comments = pgTable("comments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workItemId: integer("work_item_id").notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    workItemIdx: index("comment_work_item_idx").on(table.workItemId),
    userIdx: index("comment_user_idx").on(table.userId),
  };
});

// Attachments table
export const attachments = pgTable("attachments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workItemId: integer("work_item_id").notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    workItemIdx: index("attachment_work_item_idx").on(table.workItemId),
    userIdx: index("attachment_user_idx").on(table.userId),
  };
});

// History table
export const workItemHistory = pgTable("work_item_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workItemId: integer("work_item_id").notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id, { onDelete: 'set null' }),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changeType: varchar("change_type", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    workItemIdx: index("work_item_history_work_item_idx").on(table.workItemId),
    userIdx: index("work_item_history_user_idx").on(table.userId),
    createdAtIdx: index("work_item_history_created_at_idx").on(table.createdAt),
  };
});

// Activity log table
export const activityLog = pgTable("activity_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'set null' }),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: integer("entity_id").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  description: text("description"),
  metadata: text("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("activity_user_idx").on(table.userId),
    entityIdx: index("activity_entity_idx").on(table.entityType, table.entityId),
    actionIdx: index("activity_action_idx").on(table.action),
    createdAtIdx: index("activity_created_at_idx").on(table.createdAt),
  };
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdTeams: many(teams),
  teamMemberships: many(teamMembers),
  createdProjects: many(projects),
  assignedWorkItems: many(workItems, { relationName: "assignee" }),
  reportedWorkItems: many(workItems, { relationName: "reporter" }),
  comments: many(comments),
  attachments: many(attachments),
  activities: many(activityLog),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  creator: one(users, {
    fields: [teams.createdBy],
    references: [users.id],
  }),
  members: many(teamMembers),
  projects: many(projects),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
  workItems: many(workItems),
}));

export const workItemsRelations = relations(workItems, ({ one, many }) => ({
  project: one(projects, {
    fields: [workItems.projectId],
    references: [projects.id],
  }),
  parent: one(workItems, {
    fields: [workItems.parentId],
    references: [workItems.id],
  }),
  children: many(workItems),
  assignee: one(users, {
    fields: [workItems.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  reporter: one(users, {
    fields: [workItems.reporterId],
    references: [users.id],
    relationName: "reporter",
  }),
  comments: many(comments),
  attachments: many(attachments),
  history: many(workItemHistory),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  workItem: one(workItems, {
    fields: [comments.workItemId],
    references: [workItems.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  workItem: one(workItems, {
    fields: [attachments.workItemId],
    references: [workItems.id],
  }),
  user: one(users, {
    fields: [attachments.userId],
    references: [users.id],
  }),
}));

export const workItemHistoryRelations = relations(workItemHistory, ({ one }) => ({
  workItem: one(workItems, {
    fields: [workItemHistory.workItemId],
    references: [workItems.id],
  }),
  user: one(users, {
    fields: [workItemHistory.userId],
    references: [users.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const emailSchema = z.string().email();

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  joinedAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkItemSchema = createInsertSchema(workItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
});

export const insertWorkItemHistorySchema = createInsertSchema(workItemHistory).omit({
  id: true,
  createdAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({
  id: true,
  createdAt: true,
});

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type WorkItem = typeof workItems.$inferSelect;
export type InsertWorkItem = z.infer<typeof insertWorkItemSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;

export type WorkItemHistory = typeof workItemHistory.$inferSelect;
export type InsertWorkItemHistory = z.infer<typeof insertWorkItemHistorySchema>;

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
