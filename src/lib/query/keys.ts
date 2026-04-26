/**
 * Centralized TanStack Query keys. Centralising prevents typos and gives
 * realtime listeners a single place to find the cache slice to patch.
 */

export const queryKeys = {
  currentUser: ['currentUser'] as const,

  projects: {
    all: ['projects'] as const,
    detail: (projectId: string) => ['projects', projectId] as const,
    members: (projectId: string) => ['projects', projectId, 'members'] as const,
  },

  workflow: {
    detail: (projectId: string) => ['workflow', projectId] as const,
    statuses: (projectId: string) => ['workflow', projectId, 'statuses'] as const,
  },

  tasks: {
    all: (projectId: string) => ['tasks', projectId] as const,
    detail: (taskId: string) => ['tasks', 'detail', taskId] as const,
    mine: ['tasks', 'mine'] as const,
  },

  comments: {
    forTask: (taskId: string) => ['comments', taskId] as const,
  },

  activity: {
    forProject: (projectId: string) => ['activity', 'project', projectId] as const,
    forTask: (taskId: string) => ['activity', 'task', taskId] as const,
  },

  notifications: ['notifications'] as const,
} as const;
