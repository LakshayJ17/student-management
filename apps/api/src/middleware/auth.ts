import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export const requireTeacherAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.header("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      teacherId: number;
      email: string;
    };

    req.user = {
      teacherId: payload.teacherId,
      email: payload.email,
    };

    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
