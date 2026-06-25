// ─── Core Domain Types ─────────────────────────────────

export interface TaskState {
  id: number;
  subject: string;
  statusName: string;
  priorityName: string;
  assignee: string;
  author: string;
  projectName: string;
  typeName: string;
  pct: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonState {
  id: string;
  name: string;
  email?: string;
  totalTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  highPriorityTasks: number;
  activeRate: number;
  weeklyActivity: number;
  health: 'green' | 'yellow' | 'red' | 'unknown';
}

export interface ProjectState {
  name: string;
  totalTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  newTasks: number;
  highPriorityTasks: number;
  health: 'green' | 'yellow' | 'red' | 'unknown';
}

export interface TaskRelation {
  fromId: number;
  toId: number;
  type: string;
  desc: string;
}

export interface Snapshot {
  [id: string]: {
    st: string;   // status
    pr: string;   // priority
    as: string;   // assignee
    up: string;   // updatedAt
    su: string;   // subject
  };
}

export interface Change {
  id: number;
  type: 'new' | 'status' | 'updated' | 'removed';
  detail: string;
  subject: string;
}
