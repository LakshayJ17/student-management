import { HomeworkStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireTeacherAuth } from "../middleware/auth.js";
import { guardPromptInjection } from "../middleware/security.js";
import { buildStudentStats } from "../utils/analytics.js";
import { buildRecommendations } from "../utils/insights.js";

const createStudentSchema = z.object({
  fullName: z.string().min(2).max(100),
  rollNumber: z.string().min(1).max(30),
  gradeLevel: z.string().min(1).max(20),
  section: z.string().min(1).max(10),
});

const addMarkSchema = z.object({
  subject: z.string().min(2).max(60),
  score: z.number().nonnegative(),
  maxScore: z.number().positive(),
  testDate: z.string().datetime().optional(),
});

const addNoteSchema = z.object({
  content: z.string().min(3).max(500),
});

const addHomeworkSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(3).max(1000),
  dueDate: z.string().datetime(),
});

const updateHomeworkStatusSchema = z.object({
  status: z.nativeEnum(HomeworkStatus),
});

const attendanceSchema = z.object({
  date: z.string().datetime(),
  present: z.boolean(),
});

const optionalInstructionSchema = z.object({
  instruction: z.string().min(1).max(700).optional(),
});

export const studentsRouter = Router();

studentsRouter.get("/", async (_req, res) => {
  const students = await prisma.student.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      rollNumber: true,
      gradeLevel: true,
      section: true,
      joinedAt: true,
    },
  });

  return res.json(students);
});

studentsRouter.get("/analytics/class", async (_req, res) => {
  const students = await prisma.student.findMany({
    include: {
      marks: true,
      attendance: true,
    },
  });

  const cards = students.map((student) => {
    const stats = buildStudentStats(student.marks);
    const attendanceRate =
      student.attendance.length === 0
        ? 0
        : (student.attendance.filter((entry) => entry.present).length /
            student.attendance.length) *
          100;

    return {
      studentId: student.id,
      name: student.fullName,
      average: Number(stats.overallAverage.toFixed(2)),
      consistency: Number(stats.consistencyScore.toFixed(2)),
      attendanceRate: Number(attendanceRate.toFixed(2)),
    };
  });

  const topPerformers = cards.slice().sort((a, b) => b.average - a.average).slice(0, 5);

  return res.json({
    classAverage:
      cards.length === 0
        ? 0
        : Number((cards.reduce((acc, card) => acc + card.average, 0) / cards.length).toFixed(2)),
    topPerformers,
    cards,
  });
});

studentsRouter.get("/:id/profile", async (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid student id" });
  }

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      marks: {
        orderBy: { testDate: "asc" },
      },
      notes: {
        orderBy: { createdAt: "desc" },
      },
      homeworks: {
        orderBy: { dueDate: "asc" },
      },
      attendance: {
        orderBy: { date: "desc" },
      },
    },
  });

  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  const stats = buildStudentStats(student.marks);
  const homeworkSummary = {
    total: student.homeworks.length,
    completed: student.homeworks.filter((hw) => hw.status === HomeworkStatus.COMPLETED)
      .length,
    overdue: student.homeworks.filter((hw) => hw.status === HomeworkStatus.OVERDUE).length,
  };

  const recommendations = buildRecommendations(stats, homeworkSummary);

  return res.json({
    student: {
      id: student.id,
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      gradeLevel: student.gradeLevel,
      section: student.section,
      joinedAt: student.joinedAt,
    },
    marks: student.marks,
    notes: student.notes,
    homeworks: student.homeworks,
    attendance: student.attendance,
    stats: {
      ...stats,
      overallAverage: Number(stats.overallAverage.toFixed(2)),
      performanceStdDev: Number(stats.performanceStdDev.toFixed(2)),
      improvementRate: Number(stats.improvementRate.toFixed(2)),
      consistencyScore: Number(stats.consistencyScore.toFixed(2)),
      subjectAverages: stats.subjectAverages.map((entry) => ({
        ...entry,
        average: Number(entry.average.toFixed(2)),
      })),
      trend: stats.trend.map((point) => ({
        ...point,
        percentage: Number(point.percentage.toFixed(2)),
      })),
    },
    recommendations,
  });
});

studentsRouter.post("/:id/insights", guardPromptInjection, async (req, res) => {
  const parsed = optionalInstructionSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid instruction" });
  }

  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid student id" });
  }

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      marks: true,
      homeworks: true,
    },
  });

  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  const stats = buildStudentStats(student.marks);
  const recommendations = buildRecommendations(
    stats,
    {
      total: student.homeworks.length,
      completed: student.homeworks.filter((hw) => hw.status === HomeworkStatus.COMPLETED)
        .length,
      overdue: student.homeworks.filter((hw) => hw.status === HomeworkStatus.OVERDUE)
        .length,
    },
    parsed.data.instruction,
  );

  return res.json({ recommendations });
});

studentsRouter.post("/", requireTeacherAuth, async (req, res) => {
  const parsed = createStudentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid student payload" });
  }

  try {
    const student = await prisma.student.create({
      data: parsed.data,
    });

    return res.status(201).json(student);
  } catch {
    return res.status(409).json({ message: "Roll number already exists" });
  }
});

studentsRouter.post("/:id/marks", requireTeacherAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = addMarkSchema.safeParse(req.body);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid student id" });
  }

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid marks payload" });
  }

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  const mark = await prisma.mark.create({
    data: {
      studentId: id,
      subject: parsed.data.subject,
      score: parsed.data.score,
      maxScore: parsed.data.maxScore,
      testDate: parsed.data.testDate ? new Date(parsed.data.testDate) : new Date(),
    },
  });

  return res.status(201).json(mark);
});

studentsRouter.post("/:id/notes", requireTeacherAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = addNoteSchema.safeParse(req.body);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid student id" });
  }

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid note payload" });
  }

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  const note = await prisma.note.create({
    data: {
      studentId: id,
      content: parsed.data.content,
    },
  });

  return res.status(201).json(note);
});

studentsRouter.post("/:id/homeworks", requireTeacherAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = addHomeworkSchema.safeParse(req.body);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid student id" });
  }

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid homework payload" });
  }

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  const homework = await prisma.homework.create({
    data: {
      studentId: id,
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: new Date(parsed.data.dueDate),
    },
  });

  return res.status(201).json(homework);
});

studentsRouter.patch("/homeworks/:homeworkId", async (req, res) => {
  const homeworkId = Number(req.params.homeworkId);
  const parsed = updateHomeworkStatusSchema.safeParse(req.body);

  if (Number.isNaN(homeworkId)) {
    return res.status(400).json({ message: "Invalid homework id" });
  }

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid status payload" });
  }

  const homework = await prisma.homework.findUnique({ where: { id: homeworkId } });
  if (!homework) {
    return res.status(404).json({ message: "Homework not found" });
  }

  const updated = await prisma.homework.update({
    where: { id: homeworkId },
    data: { status: parsed.data.status },
  });

  return res.json(updated);
});

studentsRouter.post("/:id/attendance", requireTeacherAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = attendanceSchema.safeParse(req.body);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid student id" });
  }

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid attendance payload" });
  }

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  const record = await prisma.attendance.upsert({
    where: {
      studentId_date: {
        studentId: id,
        date: new Date(parsed.data.date),
      },
    },
    create: {
      studentId: id,
      date: new Date(parsed.data.date),
      present: parsed.data.present,
    },
    update: {
      present: parsed.data.present,
    },
  });

  return res.status(201).json(record);
});
