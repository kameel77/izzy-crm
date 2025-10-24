import { UserRole } from "@prisma/client";
import jwt, { SignOptions, Secret } from "jsonwebtoken";

import { env } from "../config/env.js";

interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  partnerId?: string | null;
}

const expiresIn = env.JWT_EXPIRES_IN as unknown as SignOptions["expiresIn"];
const signOptions: SignOptions = { expiresIn };

export const signToken = (payload: TokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET as Secret, signOptions);

export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET) as TokenPayload;
