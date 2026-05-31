import bcrypt from "bcryptjs";
import { PrismaClient, HomeworkStatus } from "@prisma/client";
import { config } from "../src/config.js";

const prisma = new PrismaClient();

const seed = async () => {
  const teacherHash = await bcrypt.hash(config.teacherPassword, 10);

  await prisma.teacher.upsert({
    where: { email: config.teacherEmail },
    update: { passwordHash: teacherHash, fullName: "Lead Teacher" },
    create: {
      email: config.teacherEmail,
      passwordHash: teacherHash,
      fullName: "Lead Teacher",
    },
  });

  const studentsData = [
    { fullName: "Aarav Sharma", rollNumber: "R001", gradeLevel: "10", section: "A" },
    { fullName: "Meera Patel", rollNumber: "R002", gradeLevel: "10", section: "A" },
    { fullName: "Ishaan Gupta", rollNumber: "R003", gradeLevel: "10", section: "B" },
  ];

  for (const studentData of studentsData) {
    const student = await prisma.student.upsert({
      where: { rollNumber: studentData.rollNumber },
      update: studentData,
      create: studentData,
    });

    const subjects = ["Math", "Science", "English"];
    for (const [index, subject] of subjects.entries()) {
      await prisma.mark.create({
        data: {
          studentId: student.id,
          subject,
          score: 55 + Math.random() * 40,
          maxScore: 100,
          testDate: new Date(Date.now() - (subjects.length - index) * 9 * 24 * 60 * 60 * 1000),
        },
      });
    }

    await prisma.note.create({
      data: {
        studentId: student.id,
        content: "Shows good participation in class discussions.",
      },
    });

    await prisma.homework.create({
      data: {
        studentId: student.id,
        title: "Revision Worksheet",
        description: "Complete chapter exercises and submit with detailed steps.",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: HomeworkStatus.PENDING,
      },
    });

    await prisma.attendance.upsert({
      where: {
        studentId_date: {
          studentId: student.id,
          date: new Date(new Date().toDateString()),
        },
      },
      update: { present: Math.random() > 0.15 },
      create: {
        studentId: student.id,
        date: new Date(new Date().toDateString()),
        present: Math.random() > 0.15,
      },
    });
  }
};

seed()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complete");
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    console.error(error);
    process.exit(1);
  });
