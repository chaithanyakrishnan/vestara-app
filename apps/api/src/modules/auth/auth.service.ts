import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { signAccessToken } from "../../lib/jwt";
import { ApiError } from "../../middleware/error.middleware";
import { RoleSchema, type LoginInput, type RegisterInput } from "@vestara/shared";

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
      displayName: input.displayName,
    },
  });

  return toAuthPayload(user);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new ApiError(401, "Invalid email or password");

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid email or password");

  return toAuthPayload(user);
}

/**
 * `role` is a plain String column (SQLite has no native enums — see the note in
 * schema.prisma), so Prisma types it as `string` while the rest of the app uses
 * the narrowed Role union. Parse it at this boundary rather than casting: a row
 * with a bad role is a real data problem and should fail loudly here, not leak
 * an invalid role into a signed JWT.
 */
function toAuthPayload(user: { id: string; email: string; role: string; displayName: string }) {
  const role = RoleSchema.parse(user.role);
  const accessToken = signAccessToken({ sub: user.id, role, email: user.email });
  return {
    accessToken,
    user: { id: user.id, email: user.email, role, displayName: user.displayName },
  };
}
