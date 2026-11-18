import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function protect(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.token;

  if (!token || typeof token !== "string") {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    return next(new Error("JWT_SECRET is missing or invalid."));
  }

  try {
    const payload = jwt.verify(token, secret);

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !mongoose.isValidObjectId(payload.sub)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    void User.findById(payload.sub)
      .then((user) => {
        if (!user) {
          return res.status(401).json({
            success: false,
            message: "User account not found.",
          });
        }

        req.user = {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        };

        return next();
      })
      .catch(next);

  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
}

export function authorizeRoles(...roles: Array<"customer" | "admin">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action.",
      });
    }

    return next();
  };
}
