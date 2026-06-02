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

const updateStudentSchema = z.object({
  fullName: z.string().min(2).max(100),
  rollNumber: z.string().min(1).max(30),
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

const updateMarkSchema = z.object({
  subject: z.string().min(2).max(60),
  score: z.number().nonnegative(),
  maxScore: z.number().positive(),
  testDate: z.string().datetime().optional(),
});

const updateNoteSchema = addNoteSchema;

const updateHomeworkSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(3).max(1000),
  dueDate: z.string().datetime(),
  status: z.nativeEnum(HomeworkStatus).optional(),
});

const getLocalDayRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

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
      homeworks: true,
    },
    orderBy: { fullName: "asc" },
  });

  const now = new Date();
  const { start, end } = getLocalDayRange(now);

  const studentPerformance = students.map((student) => {
    const stats = buildStudentStats(student.marks);
    const attendanceRate =
      student.attendance.length === 0
        ? 0
        : (student.attendance.filter((entry) => entry.present).length /
            student.attendance.length) *
          100;
    const missedHomeworkCount = student.homeworks.filter(
      (homework) => homework.dueDate < now && homework.status !== HomeworkStatus.COMPLETED,
    ).length;

    return {
      studentId: student.id,
      name: student.fullName,
      rollNumber: student.rollNumber,
      average: Number(stats.overallAverage.toFixed(2)),
      consistency: Number(stats.consistencyScore.toFixed(2)),
      attendanceRate: Number(attendanceRate.toFixed(2)),
      missedHomeworkCount,
    };
  });

  const topPerformers = studentPerformance.slice().sort((a, b) => b.average - a.average).slice(0, 5);
  const absentToday = await prisma.attendance.findMany({
    where: {
      date: {
        gte: start,
        lt: end,
      },
      present: false,
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          rollNumber: true,
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const missedHomework = students
    .flatMap((student) =>
      student.homeworks
        .filter((homework) => homework.dueDate < now && homework.status !== HomeworkStatus.COMPLETED)
        .map((homework) => ({
          homeworkId: homework.id,
          studentId: student.id,
          studentName: student.fullName,
          rollNumber: student.rollNumber,
          title: homework.title,
          dueDate: homework.dueDate,
          status: homework.status,
        })),
    )
    .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime());

  return res.json({
    classAverage:
      studentPerformance.length === 0
        ? 0
        : Number(
            (
              studentPerformance.reduce((acc, card) => acc + card.average, 0) /
              studentPerformance.length
            ).toFixed(2),
          ),
    topPerformers,
    studentPerformance,
    absentToday: absentToday.map((entry) => ({
      studentId: entry.studentId,
      name: entry.student.fullName,
      rollNumber: entry.student.rollNumber,
      date: entry.date,
    })),
    missedHomework,
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

studentsRouter.put("/:id", requireTeacherAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateStudentSchema.safeParse(req.body);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid student id" });
  }

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid student payload" });
  }

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  try {
    const updated = await prisma.student.update({
      where: { id },
      data: {
        fullName: parsed.data.fullName,
        rollNumber: parsed.data.rollNumber,
      },
    });

    return res.json(updated);
  } catch {
    return res.status(409).json({ message: "Roll number already exists" });
  }
});

studentsRouter.delete("/:id", requireTeacherAuth, async (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid student id" });
  }

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  await prisma.student.delete({ where: { id } });

  return res.status(204).send();
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

studentsRouter.put("/:id/marks/:markId", requireTeacherAuth, async (req, res) => {
  const studentId = Number(req.params.id);
  const markId = Number(req.params.markId);
  const parsed = updateMarkSchema.safeParse(req.body);

  if (Number.isNaN(studentId) || Number.isNaN(markId)) {
    return res.status(400).json({ message: "Invalid mark id" });
  }

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid marks payload" });
  }

  const mark = await prisma.mark.findFirst({
    where: {
      id: markId,
      studentId,
    },
  });

  if (!mark) {
    return res.status(404).json({ message: "Mark not found" });
  }

  const updated = await prisma.mark.update({
    where: { id: markId },
    data: {
      subject: parsed.data.subject,
      score: parsed.data.score,
      maxScore: parsed.data.maxScore,
      testDate: parsed.data.testDate ? new Date(parsed.data.testDate) : mark.testDate,
    },
  });

  return res.json(updated);
});

studentsRouter.delete("/:id/marks/:markId", requireTeacherAuth, async (req, res) => {
  const studentId = Number(req.params.id);
  const markId = Number(req.params.markId);

  if (Number.isNaN(studentId) || Number.isNaN(markId)) {
    return res.status(400).json({ message: "Invalid mark id" });
  }

  const mark = await prisma.mark.findFirst({
    where: {
      id: markId,
      studentId,
    },
  });

  if (!mark) {
    return res.status(404).json({ message: "Mark not found" });
  }

  await prisma.mark.delete({ where: { id: markId } });

  return res.status(204).send();
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

studentsRouter.put("/:id/notes/:noteId", requireTeacherAuth, async (req, res) => {
  const studentId = Number(req.params.id);
  const noteId = Number(req.params.noteId);
  const parsed = updateNoteSchema.safeParse(req.body);

  if (Number.isNaN(studentId) || Number.isNaN(noteId)) {
    return res.status(400).json({ message: "Invalid note id" });
  }

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid note payload" });
  }

  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      studentId,
    },
  });

  if (!note) {
    return res.status(404).json({ message: "Note not found" });
  }

  const updated = await prisma.note.update({
    where: { id: noteId },
    data: { content: parsed.data.content },
  });

  return res.json(updated);
});

studentsRouter.delete("/:id/notes/:noteId", requireTeacherAuth, async (req, res) => {
  const studentId = Number(req.params.id);
  const noteId = Number(req.params.noteId);

  if (Number.isNaN(studentId) || Number.isNaN(noteId)) {
    return res.status(400).json({ message: "Invalid note id" });
  }

  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      studentId,
    },
  });

  if (!note) {
    return res.status(404).json({ message: "Note not found" });
  }

  await prisma.note.delete({ where: { id: noteId } });

  return res.status(204).send();
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

studentsRouter.put("/:id/homeworks/:homeworkId", requireTeacherAuth, async (req, res) => {
  const studentId = Number(req.params.id);
  const homeworkId = Number(req.params.homeworkId);
  const parsed = updateHomeworkSchema.safeParse(req.body);

  if (Number.isNaN(studentId) || Number.isNaN(homeworkId)) {
    return res.status(400).json({ message: "Invalid homework id" });
  }

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid homework payload" });
  }

  const homework = await prisma.homework.findFirst({
    where: {
      id: homeworkId,
      studentId,
    },
  });

  if (!homework) {
    return res.status(404).json({ message: "Homework not found" });
  }

  const updated = await prisma.homework.update({
    where: { id: homeworkId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: new Date(parsed.data.dueDate),
      status: parsed.data.status ?? homework.status,
    },
  });

  return res.json(updated);
});

studentsRouter.delete("/:id/homeworks/:homeworkId", requireTeacherAuth, async (req, res) => {
  const studentId = Number(req.params.id);
  const homeworkId = Number(req.params.homeworkId);

  if (Number.isNaN(studentId) || Number.isNaN(homeworkId)) {
    return res.status(400).json({ message: "Invalid homework id" });
  }

  const homework = await prisma.homework.findFirst({
    where: {
      id: homeworkId,
      studentId,
    },
  });

  if (!homework) {
    return res.status(404).json({ message: "Homework not found" });
  }

  await prisma.homework.delete({ where: { id: homeworkId } });

  return res.status(204).send();
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
