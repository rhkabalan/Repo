import { z } from 'zod';

export const displayNameSchema = z
  .string()
  .trim()
  .min(3, 'Display name must be at least 3 characters')
  .max(24, 'Display name must be at most 24 characters')
  .regex(/^[\p{L}\p{N} _.-]+$/u, 'Display name may only contain letters, numbers, spaces and _ . -');

export const uuidSchema = z.string().uuid();
