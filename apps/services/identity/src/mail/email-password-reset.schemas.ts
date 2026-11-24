import { z } from 'zod';

export const forgotPasswordSchema = z
  .object({
    email: z.email(),
  })
  .strict();
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(512),
    password: z
      .string()
      .min(12)
      .max(128)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
        message:
          'Password must contain at least one lowercase letter, one uppercase letter, one number and one special character',
      }),
  })
  .strict();
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
