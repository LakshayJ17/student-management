"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const HOMEWORK_COLORS = ["#0a6c74", "#e67e22", "#d97706"];

type StudentLite = {
  id: number;
  fullName: string;
  rollNumber: string;
  gradeLevel: string;
  section: string;
};

type StudentProfile = {
  student: StudentLite & { joinedAt: string };
  marks: Array<{
    id: number;
    subject: string;
    score: number;
    maxScore: number;
    testDate: string;
  }>;
  notes: Array<{ id: number; content: string; createdAt: string }>;
  homeworks: Array<{
    id: number;
    title: string;
    description: string;
    dueDate: string;
    status: "PENDING" | "COMPLETED" | "OVERDUE";
  }>;
  attendance: Array<{ id: number; date: string; present: boolean }>;
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

type ClassAnalytics = {
  classAverage: number;
  topPerformers: Array<{
    studentId: number;
    name: string;
    average: number;
    consistency: number;
    attendanceRate: number;
  }>;
};

type Role = "landing" | "teacher" | "student";

const request = async <T,>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${API_URL}${endpoint}`, {
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

export default function Home() {
  const [role, setRole] = useState<Role>("landing");
  const [teacherToken, setTeacherToken] = useState<string>("");
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [classAnalytics, setClassAnalytics] = useState<ClassAnalytics | null>(null);
  const [insightInput, setInsightInput] = useState("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [loginPayload, setLoginPayload] = useState({
    email: "teacher@school.com",
    password: "Teacher@123",
  });

  const [studentPayload, setStudentPayload] = useState({
    fullName: "",
    rollNumber: "",
    gradeLevel: "",
    section: "",
  });

  const [markPayload, setMarkPayload] = useState({
    subject: "",
    score: "",
    maxScore: "100",
    testDate: new Date().toISOString().slice(0, 16),
  });

  const [notePayload, setNotePayload] = useState({ content: "" });
  const [homeworkPayload, setHomeworkPayload] = useState({
    title: "",
    description: "",
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16),
  });

  const [attendancePayload, setAttendancePayload] = useState({
    date: new Date().toISOString().slice(0, 16),
    present: true,
  });

  const homeworkChartData = useMemo(() => {
    if (!profile) {
      return [];
    }
    return [
      {
        name: "Pending",
        value: profile.homeworks.filter((hw) => hw.status === "PENDING").length,
      },
      {
        name: "Completed",
        value: profile.homeworks.filter((hw) => hw.status === "COMPLETED").length,
      },
      {
        name: "Overdue",
        value: profile.homeworks.filter((hw) => hw.status === "OVERDUE").length,
      },
    ];
  }, [profile]);

  const refreshStudents = useCallback(async () => {
    const data = await request<StudentLite[]>("/api/students");
    setStudents(data);
    if (!selectedStudentId && data.length > 0) {
      setSelectedStudentId(data[0].id);
    }
  }, [selectedStudentId]);

  const refreshClassAnalytics = useCallback(async () => {
    const data = await request<ClassAnalytics>("/api/students/analytics/class");
    setClassAnalytics(data);
  }, []);

  const refreshStudentProfile = useCallback(async (studentId: number) => {
    const data = await request<StudentProfile>(`/api/students/${studentId}/profile`);
    setProfile(data);
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("teacherToken") || "";
    if (token) {
      setTeacherToken(token);
    }

    refreshStudents().catch((fetchError: Error) => setError(fetchError.message));
    refreshClassAnalytics().catch(() => undefined);
  }, [refreshClassAnalytics, refreshStudents]);

  useEffect(() => {
    if (!selectedStudentId) {
      return;
    }

    refreshStudentProfile(selectedStudentId).catch((fetchError: Error) => {
      setError(fetchError.message);
    });
  }, [refreshStudentProfile, selectedStudentId]);

  const onTeacherLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await request<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginPayload),
      });
      setTeacherToken(result.token);
      window.localStorage.setItem("teacherToken", result.token);
      setRole("teacher");
      setMessage("Teacher authenticated successfully.");
    } catch (loginError) {
      setError((loginError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onAddStudent = async (event: FormEvent) => {
    event.preventDefault();
    if (!teacherToken) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await request("/api/students", {
        method: "POST",
        headers: { Authorization: `Bearer ${teacherToken}` },
        body: JSON.stringify(studentPayload),
      });

      setStudentPayload({ fullName: "", rollNumber: "", gradeLevel: "", section: "" });
      setMessage("Student added.");
      await refreshStudents();
      await refreshClassAnalytics();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const runTeacherAction = async (
    endpoint: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) => {
    if (!teacherToken || !selectedStudentId) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await request(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${teacherToken}` },
        body: JSON.stringify(body),
      });
      setMessage(successMessage);
      await refreshStudentProfile(selectedStudentId);
      await refreshClassAnalytics();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onGenerateInsights = async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    setError("");

    try {
      const result = await request<{ recommendations: string[] }>(
        `/api/students/${selectedStudentId}/insights`,
        {
          method: "POST",
          body: JSON.stringify({ instruction: insightInput }),
        },
      );

      if (profile) {
        setProfile({ ...profile, recommendations: result.recommendations });
      }
      setMessage("Recommendations refreshed.");
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const markHomeworkStatus = async (homeworkId: number, status: "COMPLETED" | "OVERDUE") => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await request(`/api/students/homeworks/${homeworkId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage("Homework status updated.");
      if (selectedStudentId) {
        await refreshStudentProfile(selectedStudentId);
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onLogoutTeacher = () => {
    setTeacherToken("");
    window.localStorage.removeItem("teacherToken");
    setRole("landing");
    setMessage("Logged out.");
  };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>StudentPulse Platform</p>
        <h1>Student Performance Management System</h1>
        <p>
          Track marks, notes, attendance, and homework in one place. Visual analytics and
          adaptive recommendations help teachers intervene early and help students improve.
        </p>
      </header>

      <main className={styles.mainGrid}>
        <section className={styles.panel}>
          <h2>Role Access</h2>
          <div className={styles.roleButtons}>
            <button type="button" onClick={() => setRole("teacher")}>
              Login As Teacher
            </button>
            <button type="button" className={styles.ghost} onClick={() => setRole("student")}>
              Continue As Student
            </button>
          </div>

          {(role === "teacher" || teacherToken) && !teacherToken && (
            <form className={styles.form} onSubmit={onTeacherLogin}>
              <label>
                Email
                <input
                  type="email"
                  value={loginPayload.email}
                  onChange={(event) =>
                    setLoginPayload((prev) => ({ ...prev, email: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={loginPayload.password}
                  onChange={(event) =>
                    setLoginPayload((prev) => ({ ...prev, password: event.target.value }))
                  }
                  required
                />
              </label>
              <button type="submit" disabled={loading}>
                {loading ? "Logging in..." : "Secure Login"}
              </button>
            </form>
          )}

          {!!teacherToken && (
            <div className={styles.teacherSession}>
              <p>Authenticated as teacher.</p>
              <button type="button" onClick={onLogoutTeacher} className={styles.ghost}>
                Logout
              </button>
            </div>
          )}

          <label className={styles.selectWrap}>
            Select Student
            <select
              value={selectedStudentId || ""}
              onChange={(event) => setSelectedStudentId(Number(event.target.value))}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName} ({student.rollNumber})
                </option>
              ))}
            </select>
          </label>

          {message && <p className={styles.success}>{message}</p>}
          {error && <p className={styles.error}>{error}</p>}
        </section>

        {teacherToken && (
          <section className={styles.panel}>
            <h2>Teacher Workspace</h2>

            <form className={styles.form} onSubmit={onAddStudent}>
              <h3>Add Student</h3>
              <input
                placeholder="Full name"
                value={studentPayload.fullName}
                onChange={(event) =>
                  setStudentPayload((prev) => ({ ...prev, fullName: event.target.value }))
                }
                required
              />
              <div className={styles.inlineFields}>
                <input
                  placeholder="Roll number"
                  value={studentPayload.rollNumber}
                  onChange={(event) =>
                    setStudentPayload((prev) => ({ ...prev, rollNumber: event.target.value }))
                  }
                  required
                />
                <input
                  placeholder="Grade"
                  value={studentPayload.gradeLevel}
                  onChange={(event) =>
                    setStudentPayload((prev) => ({ ...prev, gradeLevel: event.target.value }))
                  }
                  required
                />
                <input
                  placeholder="Section"
                  value={studentPayload.section}
                  onChange={(event) =>
                    setStudentPayload((prev) => ({ ...prev, section: event.target.value }))
                  }
                  required
                />
              </div>
              <button disabled={loading} type="submit">
                Add Student
              </button>
            </form>

            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedStudentId) return;
                runTeacherAction(
                  `/api/students/${selectedStudentId}/marks`,
                  {
                    subject: markPayload.subject,
                    score: Number(markPayload.score),
                    maxScore: Number(markPayload.maxScore),
                    testDate: new Date(markPayload.testDate).toISOString(),
                  },
                  "Marks saved.",
                );
              }}
            >
              <h3>Add Test Marks</h3>
              <div className={styles.inlineFields}>
                <input
                  placeholder="Subject"
                  value={markPayload.subject}
                  onChange={(event) =>
                    setMarkPayload((prev) => ({ ...prev, subject: event.target.value }))
                  }
                  required
                />
                <input
                  placeholder="Score"
                  type="number"
                  min="0"
                  value={markPayload.score}
                  onChange={(event) =>
                    setMarkPayload((prev) => ({ ...prev, score: event.target.value }))
                  }
                  required
                />
                <input
                  placeholder="Max"
                  type="number"
                  min="1"
                  value={markPayload.maxScore}
                  onChange={(event) =>
                    setMarkPayload((prev) => ({ ...prev, maxScore: event.target.value }))
                  }
                  required
                />
              </div>
              <input
                type="datetime-local"
                value={markPayload.testDate}
                onChange={(event) =>
                  setMarkPayload((prev) => ({ ...prev, testDate: event.target.value }))
                }
              />
              <button disabled={loading} type="submit">
                Save Marks
              </button>
            </form>

            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedStudentId) return;
                runTeacherAction(
                  `/api/students/${selectedStudentId}/notes`,
                  notePayload,
                  "Note added.",
                );
                setNotePayload({ content: "" });
              }}
            >
              <h3>Add Student Note</h3>
              <textarea
                placeholder="Contextual note for student profile"
                value={notePayload.content}
                onChange={(event) => setNotePayload({ content: event.target.value })}
                required
              />
              <button disabled={loading} type="submit">
                Save Note
              </button>
            </form>

            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedStudentId) return;
                runTeacherAction(
                  `/api/students/${selectedStudentId}/homeworks`,
                  {
                    ...homeworkPayload,
                    dueDate: new Date(homeworkPayload.dueDate).toISOString(),
                  },
                  "Homework assigned.",
                );
              }}
            >
              <h3>Assign Homework</h3>
              <input
                placeholder="Homework title"
                value={homeworkPayload.title}
                onChange={(event) =>
                  setHomeworkPayload((prev) => ({ ...prev, title: event.target.value }))
                }
                required
              />
              <textarea
                placeholder="Homework description"
                value={homeworkPayload.description}
                onChange={(event) =>
                  setHomeworkPayload((prev) => ({ ...prev, description: event.target.value }))
                }
                required
              />
              <input
                type="datetime-local"
                value={homeworkPayload.dueDate}
                onChange={(event) =>
                  setHomeworkPayload((prev) => ({ ...prev, dueDate: event.target.value }))
                }
                required
              />
              <button disabled={loading} type="submit">
                Assign Homework
              </button>
            </form>

            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedStudentId) return;
                runTeacherAction(
                  `/api/students/${selectedStudentId}/attendance`,
                  {
                    date: new Date(attendancePayload.date).toISOString(),
                    present: attendancePayload.present,
                  },
                  "Attendance updated.",
                );
              }}
            >
              <h3>Record Attendance</h3>
              <input
                type="datetime-local"
                value={attendancePayload.date}
                onChange={(event) =>
                  setAttendancePayload((prev) => ({ ...prev, date: event.target.value }))
                }
              />
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={attendancePayload.present}
                  onChange={(event) =>
                    setAttendancePayload((prev) => ({ ...prev, present: event.target.checked }))
                  }
                />
                Present
              </label>
              <button disabled={loading} type="submit">
                Save Attendance
              </button>
            </form>
          </section>
        )}

        <section className={styles.panelWide}>
          <h2>Student Dashboard</h2>
          {profile ? (
            <>
              <div className={styles.metricsGrid}>
                <article>
                  <h4>Overall Average</h4>
                  <p>{profile.stats.overallAverage}%</p>
                </article>
                <article>
                  <h4>Consistency Score</h4>
                  <p>{profile.stats.consistencyScore}%</p>
                </article>
                <article>
                  <h4>Improvement Rate</h4>
                  <p>{profile.stats.improvementRate}</p>
                </article>
                <article>
                  <h4>Std. Deviation</h4>
                  <p>{profile.stats.performanceStdDev}</p>
                </article>
              </div>

              <div className={styles.chartsGrid}>
                <div className={styles.chartCard}>
                  <h3>Performance Trend</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={profile.stats.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="testDate"
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip
                        labelFormatter={(value) => new Date(String(value)).toLocaleString()}
                      />
                      <Legend />
                      <Line
                        dataKey="percentage"
                        name="Score %"
                        stroke="#0a6c74"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className={styles.chartCard}>
                  <h3>Subject-wise Averages</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={profile.stats.subjectAverages}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="average" fill="#e67e22" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={styles.chartCard}>
                  <h3>Homework Status</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={homeworkChartData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={100}
                        label
                      >
                        {homeworkChartData.map((entry, index) => (
                          <Cell key={`${entry.name}-${entry.value}`} fill={HOMEWORK_COLORS[index]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={styles.listGrid}>
                <div className={styles.listCard}>
                  <h3>Teacher Notes</h3>
                  {profile.notes.map((note) => (
                    <article key={note.id}>
                      <p>{note.content}</p>
                      <small>{new Date(note.createdAt).toLocaleString()}</small>
                    </article>
                  ))}
                </div>

                <div className={styles.listCard}>
                  <h3>Homework</h3>
                  {profile.homeworks.map((homework) => (
                    <article key={homework.id}>
                      <p>
                        <strong>{homework.title}</strong>
                      </p>
                      <p>{homework.description}</p>
                      <small>
                        Due {new Date(homework.dueDate).toLocaleDateString()} | {homework.status}
                      </small>
                      <div className={styles.inlineButtons}>
                        <button
                          type="button"
                          onClick={() => markHomeworkStatus(homework.id, "COMPLETED")}
                        >
                          Mark Complete
                        </button>
                        <button
                          type="button"
                          className={styles.ghost}
                          onClick={() => markHomeworkStatus(homework.id, "OVERDUE")}
                        >
                          Mark Overdue
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className={styles.panelInset}>
                <h3>AI Improvement Recommendations</h3>
                <textarea
                  value={insightInput}
                  onChange={(event) => setInsightInput(event.target.value)}
                  placeholder="Optional instruction (example: focus on math and attendance this month)"
                />
                <button type="button" onClick={onGenerateInsights} disabled={loading}>
                  Refresh Recommendations
                </button>
                <ul className={styles.recoList}>
                  {profile.recommendations.map((recommendation) => (
                    <li key={recommendation}>{recommendation}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p>No student profile selected.</p>
          )}
        </section>

        <section className={styles.panel}>
          <h2>Class Insights</h2>
          {classAnalytics ? (
            <>
              <p className={styles.bigStat}>Class Average: {classAnalytics.classAverage}%</p>
              <ul className={styles.topList}>
                {classAnalytics.topPerformers.map((entry) => (
                  <li key={entry.studentId}>
                    <span>{entry.name}</span>
                    <span>{entry.average}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>Loading analytics...</p>
          )}
        </section>
      </main>
    </div>
  );
}
