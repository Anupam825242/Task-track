import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  fullName: z.string().trim().min(1).max(120),
  role: z.enum(['admin', 'pm', 'user']).default('user'),
  password: z.string().min(8).max(72).optional(),
  // If password omitted, an email invite is sent (Supabase handles).
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'pm', 'user']),
});

export const DeactivateUserSchema = z.object({
  userId: z.string().uuid(),
  active: z.boolean(),
});

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;
