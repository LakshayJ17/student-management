import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  teacherEmail: process.env.TEACHER_EMAIL || "teacher@school.com",
  teacherPassword: process.env.TEACHER_PASSWORD || "Teacher@123",
};
