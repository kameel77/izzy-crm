import { UserRole, UserStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authorize } from "../middlewares/authorize.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createUser,
  listUsers,
  resetPassword,
  updateUser,
} from "../services/user.service.js";

const router = Router();

const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).default(20).optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  partnerId: z.string().optional(),
  search: z.string().optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole),
  partnerId: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  password: z.string().min(8).optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  partnerId: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

router.get(
  "/",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const query = listUsersSchema.parse(req.query);

    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const { items, total } = await listUsers({
      role: query.role,
      status: query.status,
      partnerId: query.partnerId,
      search: query.search,
      skip,
      take: perPage,
    });

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    res.json({
      data: items,
      meta: {
        page,
        perPage,
        total,
        totalPages,
      },
    });
  }),
);

router.post(
  "/",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const payload = createUserSchema.parse(req.body);

    if (payload.role === UserRole.ADMIN && req.user?.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Only admins can create admin accounts" });
    }

    const user = await createUser({
      email: payload.email,
      fullName: payload.fullName,
      phone: payload.phone,
      role: payload.role,
      partnerId: payload.partnerId ?? null,
      status: payload.status,
      password: payload.password,
    });

    res.status(201).json(user);
  }),
);

router.patch(
  "/:id",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(req.params);
    const payload = updateUserSchema.parse(req.body);

    if (payload.role === UserRole.ADMIN && req.user?.role !== UserRole.ADMIN) {
      return res
        .status(403)
        .json({ message: "Only admins can escalate accounts to admin role" });
    }

    const user = await updateUser({
      id,
      fullName: payload.fullName,
      phone: typeof payload.phone === "undefined" ? undefined : payload.phone,
      role: payload.role,
      status: payload.status,
      partnerId: typeof payload.partnerId === "undefined" ? undefined : payload.partnerId,
      password: payload.password,
    });

    res.json(user);
  }),
);

router.post(
  "/:id/reset-password",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(req.params);
    const { password } = resetPasswordSchema.parse(req.body);

    await resetPassword({ userId: id, newPassword: password });

    res.status(204).send();
  }),
);

export { router as userRouter };
