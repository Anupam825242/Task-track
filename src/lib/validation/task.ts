import { z } from 'zod';

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);

export const CreateTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, 'Title required').max(300),
  description: z.string().max(20000).optional().nullable(),
  statusId: z.string().uuid(),
  assignedTo: z.string().uuid().nullable().optional(),
  priority: TaskPrioritySchema.default('medium'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
    .nullable()
    .optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  taskId: z.string().uuid(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const MoveTaskSchema = z.object({
  taskId: z.string().uuid(),
  toStatusId: z.string().uuid(),
  beforeTaskId: z.string().uuid().nullable(),
  afterTaskId: z.string().uuid().nullable(),
});
export type MoveTaskInput = z.infer<typeof MoveTaskSchema>;

export const DeleteTaskSchema = z.object({
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
});
