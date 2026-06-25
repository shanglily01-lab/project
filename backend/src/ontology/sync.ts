import type { TaskState, PersonState, ProjectState } from '../types.js';

// ─── Helper ──────────────────────────────────────────

function isBlocked(t: TaskState): boolean {
  return t.statusName === 'On hold' || t.statusName === 'Rejected' || t.statusName === 'Test failed';
}

function isInProgress(t: TaskState): boolean {
  return t.statusName === 'In progress';
}

function isNew(t: TaskState): boolean {
  return t.statusName === 'New';
}

function isHighPri(t: TaskState): boolean {
  return t.priorityName === 'High' || t.priorityName === 'Immediate';
}

// ─── Pure Functions ──────────────────────────────────

export function buildPersonStates(tasks: TaskState[]): PersonState[] {
  const byAssignee: Record<string, TaskState[]> = {};

  for (const t of tasks) {
    const key = t.assignee || 'Unassigned';
    (byAssignee[key] ??= []).push(t);
  }

  return Object.entries(byAssignee).map(([name, personTasks]) => {
    const totalTasks = personTasks.length;
    const inProgressTasks = personTasks.filter(isInProgress).length;
    const blockedTasks = personTasks.filter(isBlocked).length;
    const highPriorityTasks = personTasks.filter(isHighPri).length;
    const activeRate = totalTasks > 0 ? inProgressTasks / totalTasks : 0;

    const state: PersonState = {
      id: name,
      name,
      totalTasks,
      inProgressTasks,
      blockedTasks,
      highPriorityTasks,
      activeRate,
      weeklyActivity: inProgressTasks,
      health: 'unknown',
    };
    state.health = computeHealth(state);
    return state;
  });
}

export function buildProjectStates(tasks: TaskState[]): ProjectState[] {
  const byProject: Record<string, TaskState[]> = {};

  for (const t of tasks) {
    const key = t.projectName || 'Unknown';
    (byProject[key] ??= []).push(t);
  }

  return Object.entries(byProject).map(([name, projectTasks]) => {
    const totalTasks = projectTasks.length;
    const inProgressTasks = projectTasks.filter(isInProgress).length;
    const blockedTasks = projectTasks.filter(isBlocked).length;
    const newTasks = projectTasks.filter(isNew).length;
    const highPriorityTasks = projectTasks.filter(isHighPri).length;

    const state: ProjectState = {
      name,
      totalTasks,
      inProgressTasks,
      blockedTasks,
      newTasks,
      highPriorityTasks,
      health: 'unknown',
    };
    state.health = computeProjectHealth(state);
    return state;
  });
}

export function computeHealth(person: PersonState): 'green' | 'yellow' | 'red' {
  if (person.totalTasks === 0) return 'green';

  const activeRate = person.activeRate;
  const blocked = person.blockedTasks;

  if (activeRate > 0.3 && blocked === 0) return 'green';
  if (activeRate > 0.1 || blocked < 2) return 'yellow';
  return 'red';
}

export function computeProjectHealth(project: ProjectState): 'green' | 'yellow' | 'red' {
  if (project.totalTasks === 0) return 'green';

  const activeRate = project.inProgressTasks / project.totalTasks;
  const blocked = project.blockedTasks;

  if (activeRate > 0.3 && blocked === 0) return 'green';
  if (activeRate > 0.1 || blocked < 2) return 'yellow';
  return 'red';
}
