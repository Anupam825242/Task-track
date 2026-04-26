import { z } from 'zod';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export const StatusInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(50),
  position: z.number().int().min(0),
  color: z.string().regex(HEX_COLOR, 'Use a #RRGGBB hex color').default('#6B7280'),
  isTerminal: z.boolean().default(false),
});

export const CreateStatusSchema = z.object({
  workflowId: z.string().uuid(),
  status: StatusInputSchema.omit({ id: true }),
});

export const UpdateStatusSchema = z.object({
  statusId: z.string().uuid(),
  patch: StatusInputSchema.partial().omit({ id: true }),
});

export const ReorderStatusesSchema = z.object({
  workflowId: z.string().uuid(),
  ordered: z.array(z.object({ id: z.string().uuid(), position: z.number().int().min(0) })).min(1),
});

export const DeleteStatusSchema = z.object({
  statusId: z.string().uuid(),
  migrateToStatusId: z.string().uuid().optional(),
});

export type StatusInput = z.infer<typeof StatusInputSchema>;
export type ReorderStatusesInput = z.infer<typeof ReorderStatusesSchema>;
