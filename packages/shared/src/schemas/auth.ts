import { z } from "zod";

export const RoleSchema = z.enum(["sponsor", "advisor"]);
export type Role = z.infer<typeof RoleSchema>;

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: RoleSchema,
  displayName: z.string().min(1),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: RoleSchema,
  displayName: z.string(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;
