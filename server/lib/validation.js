import { z } from 'zod';
export const text = (max = 2000) => z.string().trim().min(1).max(max);
export const projectInput = z.object({
  name: text(100),
  client: text(100),
  description: z.string().trim().max(200).default(''),
  brief: text(12000),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((x) => !Number.isNaN(Date.parse(x)), 'Invalid date'),
});
export const annotationInput = z.object({
  text: text(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  version: text(100),
  page: z.number().int().min(1).max(300).default(1),
  requirementId: z.string().max(100).nullable().default(null),
});
export const taskInput = z.object({
  title: text(200),
  description: z.string().max(3000).default(''),
  annotationId: z.string().nullable().default(null),
  requirementId: z.string().nullable().default(null),
  assignee: z.string().max(80).default('Unassigned'),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});
export const taskPatch = z
  .object({
    status: z.enum(['todo', 'doing', 'done']).optional(),
    assignee: z.string().trim().min(1).max(80).optional(),
    due: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
  })
  .refine((x) => Object.keys(x).length > 0, 'Provide a change');
export const authInput = z.object({
  email: z
    .string()
    .email()
    .max(200)
    .transform((x) => x.toLowerCase()),
  password: z.string().min(10).max(128),
  name: text(80).optional(),
});
