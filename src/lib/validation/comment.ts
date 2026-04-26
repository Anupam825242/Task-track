import { z } from 'zod';

export const CreateCommentSchema = z.object({
  taskId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
  parentId: z.string().uuid().nullable().optional(),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export const UpdateCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});

export const DeleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});
