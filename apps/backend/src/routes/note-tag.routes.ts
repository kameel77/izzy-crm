import { UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authorize } from "../middlewares/authorize.js";
import {
  createNoteTag,
  deleteNoteTag,
  listNoteTags,
  updateNoteTag,
} from "../services/note-tag.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const tagBodySchema = z.object({
  name: z.string().min(2).max(50),
});

const tagParamSchema = z.object({
  id: z.string().cuid(),
});

router.get(
  "/",
  authorize(
    UserRole.PARTNER,
    UserRole.PARTNER_MANAGER,
    UserRole.PARTNER_EMPLOYEE,
    UserRole.OPERATOR,
    UserRole.SUPERVISOR,
    UserRole.ADMIN,
  ),
  asyncHandler(async (_req, res) => {
    const tags = await listNoteTags();

    return res.json({ data: tags });
  }),
);

router.post(
  "/",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const body = tagBodySchema.parse(req.body);

    const tag = await createNoteTag({ name: body.name });

    return res.status(201).json(tag);
  }),
);

router.patch(
  "/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = tagParamSchema.parse(req.params);
    const body = tagBodySchema.parse(req.body);

    const tag = await updateNoteTag(id, { name: body.name });

    return res.json(tag);
  }),
);

router.delete(
  "/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = tagParamSchema.parse(req.params);

    await deleteNoteTag(id);

    return res.status(204).send();
  }),
);

export { router as noteTagRouter };
