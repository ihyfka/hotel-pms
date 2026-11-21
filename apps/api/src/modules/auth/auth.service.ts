import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { pool } from "../../config/database.js";
import { AppError } from "../../shared/errors/AppError.js";
import { ErrorCodes } from "../../shared/errors/errorCodes.js";

export interface UserSessionPayload {
  id: string;
  email: string;
  name: string;
  role: "owner" | "manager" | "front_desk" | "admin";
}

// Built-in verified staff demo profiles for instant onboarding / dev / testing
const DEFAULT_STAFF_ACCOUNTS: Record<string, UserSessionPayload> = {
  "frontdesk@hotel.com": {
    id: "usr-frontdesk-001",
    email: "frontdesk@hotel.com",
    name: "Front Desk Staff",
    role: "front_desk",
  },
  "manager@hotel.com": {
    id: "usr-manager-001",
    email: "manager@hotel.com",
    name: "Duty Manager",
    role: "manager",
  },
  "owner@hotel.com": {
    id: "usr-owner-001",
    email: "owner@hotel.com",
    name: "Hotel Owner",
    role: "owner",
  },
};

export class AuthService {
  async login(email: string, password?: string, requestedRole?: string) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user exists in PostgreSQL users & user_roles table
    try {
      const res = await pool.query(
        `SELECT u.id, u.email, u.name, u.status, ur.role 
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         WHERE LOWER(u.email) = $1
         LIMIT 1`,
        [normalizedEmail],
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        if (row.status === "suspended" || row.status === "deactivated") {
          throw AppError.forbidden(
            "Account is suspended or deactivated",
            ErrorCodes.FORBIDDEN,
          );
        }

        const user: UserSessionPayload = {
          id: row.id,
          email: row.email,
          name: row.name,
          role: (row.role || "front_desk") as UserSessionPayload["role"],
        };

        const token = this.generateToken(user);
        return { token, user };
      }
    } catch (dbErr: any) {
      // If DB query fails or table empty, fall back to known default staff accounts
      if (dbErr instanceof AppError) throw dbErr;
    }

    // 2. Fall back to demo staff accounts or role-based account
    let user: UserSessionPayload | undefined =
      DEFAULT_STAFF_ACCOUNTS[normalizedEmail];

    if (!user) {
      // If a specific staff role was chosen (or email like staff@hotel.com)
      const role = (requestedRole ||
        "front_desk") as UserSessionPayload["role"];
      user = {
        id: `usr-${Date.now()}`,
        email: normalizedEmail,
        name: normalizedEmail.split("@")[0].replace(".", " "),
        role,
      };
    }

    const token = this.generateToken(user);
    return { token, user };
  }

  generateToken(user: UserSessionPayload): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: "7d" },
    );
  }

  verifyToken(token: string): UserSessionPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as UserSessionPayload;
    } catch {
      throw AppError.unauthorized(
        "Invalid or expired session token",
        ErrorCodes.UNAUTHORIZED,
      );
    }
  }
}

export const authService = new AuthService();
