const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

export type StudentLite = {
  id: number;
  fullName: string;
  rollNumber: string;
  gradeLevel: string;
  section: string;
};

export type StudentMark = {
  id: number;
  subject: string;
  score: number;
  maxScore: number;
  testDate: string;
};

export type StudentNote = {
  id: number;
  content: string;
  createdAt: string;
};

export type StudentHomework = {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  status: "PENDING" | "COMPLETED" | "OVERDUE";
};

export type StudentAttendance = {
  id: number;
  date: string;
  present: boolean;
};

export type StudentProfile = {
  student: StudentLite & { joinedAt: string };
  marks: StudentMark[];
  notes: StudentNote[];
  homeworks: StudentHomework[];
  attendance: StudentAttendance[];
  stats: {
    overallAverage: number;
    performanceStdDev: number;
    improvementRate: number;
    consistencyScore: number;
    subjectAverages: Array<{ subject: string; average: number }>;
    trend: Array<{ subject: string; testDate: string; percentage: number }>;
  };
  recommendations: string[];
};

export type ClassAnalytics = {
  classAverage: number;
  topPerformers: Array<{
    studentId: number;
    name: string;
    rollNumber: string;
    average: number;
    consistency: number;
    attendanceRate: number;
    missedHomeworkCount: number;
  }>;
  studentPerformance: Array<{
    studentId: number;
    name: string;
    rollNumber: string;
    average: number;
    consistency: number;
    attendanceRate: number;
    missedHomeworkCount: number;
  }>;
  absentToday: Array<{
    studentId: number;
    name: string;
    rollNumber: string;
    date: string;
  }>;
  missedHomework: Array<{
    homeworkId: number;
    studentId: number;
    studentName: string;
    rollNumber: string;
    title: string;
    dueDate: string;
    status: "PENDING" | "COMPLETED" | "OVERDUE";
  }>;
};

export const request = async <T,>(endpoint: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(payload.message || "Request failed");
  }

  return response.json() as Promise<T>;
};

export const toLocalDateTimeInputValue = (date: Date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};
