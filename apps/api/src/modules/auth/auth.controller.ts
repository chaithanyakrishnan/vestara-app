import type { Request, Response } from "express";
import { LoginSchema, RegisterSchema } from "@vestara/shared";
import * as authService from "./auth.service";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../middleware/error.middleware";

export async function registerHandler(req: Request, res: Response) {
  const input = RegisterSchema.parse(req.body);
  const result = await authService.register(input);
  res.status(201).json(result);
}

export async function loginHandler(req: Request, res: Response) {
  const input = LoginSchema.parse(req.body);
  const result = await authService.login(input);
  res.status(200).json(result);
}

export async function meHandler(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) throw new ApiError(404, "User not found");
  res.json({ id: user.id, email: user.email, role: user.role, displayName: user.displayName });
}
