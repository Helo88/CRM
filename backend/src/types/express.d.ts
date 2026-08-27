import type { UserRole } from "../models/User";

// Augments Express's Request type so req.user (set by requireAuth) is typed
// everywhere without every route handler having to cast it.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        name: string;
      };
    }
  }
}

export {};
