import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db.js";
import { config } from "../config.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(120),
});

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid email or password format" });
  }

  const { email, password } = parsed.data;

  const teacher = await prisma.teacher.findUnique({ where: { email } });

  if (!teacher) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isPasswordValid = await bcrypt.compare(password, teacher.passwordHash);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    {
      teacherId: teacher.id,
      email: teacher.email,
    },
    config.jwtSecret,
    { expiresIn: "12h" },
  );

  return res.json({
    token,
    teacher: {
      id: teacher.id,
      email: teacher.email,
      fullName: teacher.fullName,
    },
  });
});
