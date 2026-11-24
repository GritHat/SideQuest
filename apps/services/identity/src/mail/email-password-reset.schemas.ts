import { z } from 'zod';
import { passwordSchema } from '../auth/auth.schemas.js';

export const forgotPasswordSchema = z
  .object({
    email: z.email(),
  })
  .strict();
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(512),
    password: passwordSchema,
  })
  .strict();
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
