import { UserRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

import { verifyToken } from "../utils/jwt.js";

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing authorization header" });
  }

  const token = header.split(" ")[1];

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role as UserRole,
      partnerId: payload.partnerId ?? undefined,
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
