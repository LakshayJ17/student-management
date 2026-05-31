import { NextFunction, Request, Response } from "express";
import sanitizeHtml from "sanitize-html";

const suspiciousPromptPatterns = [
  /ignore\s+all\s+previous\s+instructions/i,
  /reveal\s+system\s+prompt/i,
  /jailbreak/i,
  /bypass\s+safety/i,
  /developer\s+message/i,
];

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sanitizeValue(nestedValue),
      ]),
    );
  }

  return value;
};

export const sanitizeRequestBody = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  next();
};

export const guardPromptInjection = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const instruction =
    typeof req.body?.instruction === "string" ? req.body.instruction : "";

  if (instruction.length > 700) {
    return res
      .status(400)
      .json({ message: "Instruction too long. Keep it under 700 characters." });
  }

  if (suspiciousPromptPatterns.some((pattern) => pattern.test(instruction))) {
    return res.status(400).json({
      message: "Unsafe instruction detected. Please provide academic guidance only.",
    });
  }

  return next();
};
