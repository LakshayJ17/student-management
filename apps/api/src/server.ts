import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { sanitizeRequestBody } from "./middleware/security.js";
import { authRouter } from "./routes/auth.js";
import { studentsRouter } from "./routes/students.js";

const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH"],
  }),
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "300kb" }));
app.use(cookieParser());
app.use(sanitizeRequestBody);

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: "Too many login attempts. Please retry after 15 minutes.",
    },
  }),
);

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", service: "student-performance-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/students", studentsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}`);
});
