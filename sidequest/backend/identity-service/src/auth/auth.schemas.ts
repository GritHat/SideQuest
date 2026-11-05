
import { z } from 'zod';

export const signUpSchema = z.object({
  username: z.string().min(3).max(64),
  email: z.email(),
  password: z.string().min(12).max(128),
});
export type SignUpDto = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email(),
  password: z.string(),
});
export type SignInDto = z.infer<typeof signInSchema>;
