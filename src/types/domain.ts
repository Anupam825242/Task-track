/**
 * Application-level domain types. These are derived from (or aligned with)
 * the database schema and intended for use throughout the app.
 *
 * Once `pnpm db:types` populates `src/types/db.ts` from the live schema,
 * we'll switch many of these to `Database['public']['Tables'][...]['Row']`.
 */

export type UserRole = 'admin' | 'pm' | 'user';
export type ProjectMemberRole = 'pm' | 'member';
export type TaskPriority = 'low' | 'medium' | 'high';

export type ActivityAction =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'task_assigned'
  | 'task_unassigned'
  | 'task_status_changed'
  | 'comment_added'
  | 'comment_deleted'
  | 'member_added'
  | 'member_removed';

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  added_by: string | null;
  added_at: string;
}

export interface Workflow {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Status {
  id: string;
  workflow_id: string;
  name: string;
  position: number;
  color: string;
  is_terminal: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status_id: string;
  assigned_to: string | null;
  created_by: string;
  priority: TaskPriority;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  project_id: string;
  task_id: string | null;
  actor_id: string | null;
  action: ActivityAction;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Notification {
  id: number;
  recipient_id: string;
  type: string;
  task_id: string | null;
  project_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

// Composite views used in the UI
export interface TaskWithRelations extends Task {
  assignee: Pick<AppUser, 'id' | 'full_name' | 'avatar_url' | 'email'> | null;
  creator: Pick<AppUser, 'id' | 'full_name' | 'avatar_url' | 'email'> | null;
}

export interface ProjectWithMembership extends Project {
  member_role: ProjectMemberRole | null;
  member_count: number;
}
