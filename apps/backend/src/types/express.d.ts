import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      email: string;
      role: UserRole;
      partnerId?: string;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
