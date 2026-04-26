import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name required').max(200),
  description: z.string().max(5000).optional().nullable(),
  memberIds: z.array(z.string().uuid()).default([]),
  pmIds: z.array(z.string().uuid()).default([]),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  archived: z.boolean().optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const AddMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['pm', 'member']).default('member'),
});

export const RemoveMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
});
