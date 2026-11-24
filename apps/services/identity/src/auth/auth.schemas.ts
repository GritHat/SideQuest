
import { z } from 'zod';

export const passwordSchema = z.string().min(12).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message: 'Password must contain at least one lowercase letter, one uppercase letter, one number and one special character',
  });

export const signUpSchema = z.object({
  username: z.string().min(3).max(64),
  email: z.email(),
  password: passwordSchema,
}).strict();
export type SignUpDto = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email(),
  password: z.string(),
}).strict();
export type SignInDto = z.infer<typeof signInSchema>;
