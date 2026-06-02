"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../app/page.module.css";
import {
  ClassAnalytics,
  StudentLite,
  StudentProfile,
  request,
  toLocalDateTimeInputValue,
} from "../lib/dashboard";
import { StudentProfilePanel } from "./student-profile-panel";

const DASHBOARD_SECTIONS = [
  { id: "overview", label: "Overview", hint: "Session and student focus" },
  { id: "students", label: "Students", hint: "Add and choose a learner" },
  { id: "marks", label: "Marks", hint: "Tests and score edits" },
  { id: "notes", label: "Notes", hint: "Teacher comments" },
  { id: "homework", label: "Homework", hint: "Assign and extend deadlines" },
  { id: "attendance", label: "Attendance", hint: "Daily presence tracking" },
  { id: "snapshot", label: "Snapshot", hint: "Profile, charts, and actions" },
  { id: "insights", label: "Insights", hint: "Performance summary" },
];

export default function TeacherDashboard() {
  const router = useRouter();
  const [teacherToken, setTeacherToken] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [classAnalytics, setClassAnalytics] = useState<ClassAnalytics | null>(null);
  const [insightInput, setInsightInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    testDate: toLocalDateTimeInputValue(),
  });

  const [notePayload, setNotePayload] = useState({ content: "" });
  const [homeworkPayload, setHomeworkPayload] = useState({
    title: "",
    description: "",
    dueDate: toLocalDateTimeInputValue(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
  });

  const [attendancePayload, setAttendancePayload] = useState({
    date: toLocalDateTimeInputValue(),
    present: true,
  });
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileSection, setMobileSection] = useState("snapshot");
  const [isCompactLayout, setIsCompactLayout] = useState(false);

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
    if (!token) {
      router.replace("/login");
      return;
    }

    setTeacherToken(token);
  }, [router]);

  useEffect(() => {
    const updateLayoutMode = () => {
      setIsCompactLayout(window.innerWidth <= 1050);
      setMobileSection((currentSection) =>
        window.innerWidth <= 1050 && currentSection === "overview" ? "snapshot" : currentSection,
      );
    };

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);

    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

  useEffect(() => {
    if (!teacherToken) {
      return;
    }

    refreshStudents().catch((fetchError: Error) => setError(fetchError.message));
    refreshClassAnalytics().catch(() => undefined);
  }, [refreshClassAnalytics, refreshStudents, teacherToken]);

  useEffect(() => {
    if (!teacherToken || !selectedStudentId) {
      return;
    }

    refreshStudentProfile(selectedStudentId).catch((fetchError: Error) => {
      setError(fetchError.message);
    });
  }, [refreshStudentProfile, selectedStudentId, teacherToken]);

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

  const onEditStudent = async (student: StudentLite) => {
    if (!teacherToken) return;

    const fullName = window.prompt("Update student name", student.fullName)?.trim();
    if (!fullName) return;

    const rollNumber = window.prompt("Update roll number", student.rollNumber)?.trim();
    if (!rollNumber) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await request(`/api/students/${student.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${teacherToken}` },
        body: JSON.stringify({ fullName, rollNumber }),
      });

      setMessage("Student updated.");
      await refreshStudents();
      await refreshClassAnalytics();

      if (selectedStudentId === student.id) {
        await refreshStudentProfile(student.id);
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onDeleteStudent = async (student: StudentLite) => {
    if (!teacherToken) return;

    if (!window.confirm(`Delete ${student.fullName} and all related records?`)) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await request(`/api/students/${student.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${teacherToken}` },
      });

      setMessage("Student removed.");
      setProfile(null);
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

  const runTeacherMutation = async (
    endpoint: string,
    method: "PUT" | "DELETE",
    body: Record<string, unknown> | undefined,
    successMessage: string,
  ) => {
    if (!teacherToken || !selectedStudentId) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await request(endpoint, {
        method,
        headers: { Authorization: `Bearer ${teacherToken}` },
        body: body ? JSON.stringify(body) : undefined,
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

  const onEditMark = async (mark: StudentProfile["marks"][number]) => {
    if (!selectedStudentId) return;

    const subject = window.prompt("Update subject", mark.subject)?.trim();
    if (!subject) return;

    const scoreInput = window.prompt("Update score", String(mark.score));
    if (scoreInput === null) return;

    const maxScoreInput = window.prompt("Update max score", String(mark.maxScore));
    if (maxScoreInput === null) return;

    const testDateInput = window.prompt(
      "Update test date (YYYY-MM-DDTHH:mm)",
      toLocalDateTimeInputValue(new Date(mark.testDate)),
    );
    if (testDateInput === null) return;

    const score = Number(scoreInput);
    const maxScore = Number(maxScoreInput);

    if (Number.isNaN(score) || Number.isNaN(maxScore)) {
      setError("Mark values must be numbers.");
      return;
    }

    await runTeacherMutation(
      `/api/students/${selectedStudentId}/marks/${mark.id}`,
      "PUT",
      {
        subject,
        score,
        maxScore,
        testDate: new Date(testDateInput).toISOString(),
      },
      "Mark updated.",
    );
  };

  const onDeleteMark = async (mark: StudentProfile["marks"][number]) => {
    if (!selectedStudentId) return;

    if (!window.confirm(`Delete the ${mark.subject} mark?`)) return;

    await runTeacherMutation(
      `/api/students/${selectedStudentId}/marks/${mark.id}`,
      "DELETE",
      undefined,
      "Mark deleted.",
    );
  };

  const onEditNote = async (note: StudentProfile["notes"][number]) => {
    if (!selectedStudentId) return;

    const content = window.prompt("Update note", note.content)?.trim();
    if (!content) return;

    await runTeacherMutation(
      `/api/students/${selectedStudentId}/notes/${note.id}`,
      "PUT",
      { content },
      "Note updated.",
    );
  };

  const onDeleteNote = async (note: StudentProfile["notes"][number]) => {
    if (!selectedStudentId) return;

    if (!window.confirm("Delete this note?")) return;

    await runTeacherMutation(
      `/api/students/${selectedStudentId}/notes/${note.id}`,
      "DELETE",
      undefined,
      "Note deleted.",
    );
  };

  const onEditHomework = async (homework: StudentProfile["homeworks"][number]) => {
    if (!selectedStudentId) return;

    const title = window.prompt("Update homework title", homework.title)?.trim();
    if (!title) return;

    const description = window.prompt("Update homework description", homework.description)?.trim();
    if (!description) return;

    const dueDateInput = window.prompt(
      "Extend deadline (YYYY-MM-DDTHH:mm)",
      toLocalDateTimeInputValue(new Date(homework.dueDate)),
    );
    if (dueDateInput === null) return;

    await runTeacherMutation(
      `/api/students/${selectedStudentId}/homeworks/${homework.id}`,
      "PUT",
      {
        title,
        description,
        dueDate: new Date(dueDateInput).toISOString(),
        status: homework.status,
      },
      "Homework updated.",
    );
  };

  const onDeleteHomework = async (homework: StudentProfile["homeworks"][number]) => {
    if (!selectedStudentId) return;

    if (!window.confirm(`Delete homework ${homework.title}?`)) return;

    await runTeacherMutation(
      `/api/students/${selectedStudentId}/homeworks/${homework.id}`,
      "DELETE",
      undefined,
      "Homework deleted.",
    );
  };

  const onLogoutTeacher = () => {
    setTeacherToken("");
    window.localStorage.removeItem("teacherToken");
    router.push("/login");
  };

  const jumpToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    setMobileSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const shouldRenderSection = (sectionId: string) => !isCompactLayout || mobileSection === sectionId;

  const renderIconButton = (
    label: string,
    onClick: () => void,
    kind: "edit" | "delete" | "select",
  ) => {
    const icon =
      kind === "edit" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 17.25V20h2.75L17.8 8.95l-2.75-2.75L4 17.25Zm14.71-8.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.24 1.24 3.91 3.91 1.24-1.24Z"
            fill="currentColor"
          />
        </svg>
      ) : kind === "delete" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 3.75h6l1 1.5h4v2h-1v11.25A2.5 2.5 0 0 1 16.5 21h-9A2.5 2.5 0 0 1 5 18.5V7.25H4v-2h4l1-1.5Zm1.5 5v8h-2v-8h2Zm5 0v8h-2v-8h2Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2 2 22h20L12 2Zm0 5.2 5.1 10.3H6.9L12 7.2Z"
            fill="currentColor"
          />
        </svg>
      );

    return (
      <button type="button" className={styles.iconButton} aria-label={label} onClick={onClick}>
        {icon}
      </button>
    );
  };

  if (!teacherToken) {
    return null;
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>StudentPulse Platform</p>
        <h1>Teacher Dashboard</h1>
        <p>
          Manage students, assign work, record outcomes, and review performance signals from one
          place.
        </p>
      </header>

      <section className={styles.topSummary}>
        <article>
          <span>Active student</span>
          <strong>
            {students.find((student) => student.id === selectedStudentId)?.fullName || "Choose one"}
          </strong>
        </article>
        <article>
          <span>Class average</span>
          <strong>{classAnalytics ? `${classAnalytics.classAverage}%` : "Loading"}</strong>
        </article>
        <article>
          <span>Need attention</span>
          <strong>
            {classAnalytics ? `${classAnalytics.absentToday.length + classAnalytics.missedHomework.length}` : "Loading"}
          </strong>
        </article>
        <article>
          <span>Mode</span>
          <strong>Teacher workspace</strong>
        </article>
      </section>

      <main className={styles.dashboardShell}>
        <aside className={styles.dashboardSidebar}>
          <section className={styles.panel} id="overview">
            <h2>Teacher Session</h2>
            <div className={styles.teacherSession}>
              <div>
                <p className={styles.sectionLabel}>Signed in</p>
                <p>Teacher account active</p>
              </div>
              <button type="button" onClick={onLogoutTeacher} className={styles.ghost}>
                Logout
              </button>
            </div>

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

          <nav className={styles.dashboardNav} aria-label="Teacher dashboard sections">
            <p className={styles.sectionLabel}>Workspace</p>
            {DASHBOARD_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`${styles.navButton} ${activeSection === section.id ? styles.navButtonActive : ""}`}
                onClick={() => jumpToSection(section.id)}
              >
                <span>{section.label}</span>
                <small>{section.hint}</small>
              </button>
            ))}
          </nav>
        </aside>

        <section className={styles.dashboardContent}>
          <div className={styles.mobileSectionPicker}>
            <label className={styles.selectWrap}>
              Jump to section
              <select
                value={mobileSection}
                onChange={(event) => jumpToSection(event.target.value)}
              >
                {DASHBOARD_SECTIONS.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {shouldRenderSection("students") && (
          <section className={styles.panelWide} id="students">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Student management</p>
                <h2>Students</h2>
              </div>
              <p className={styles.sectionHint}>Create, edit, select, or remove students here.</p>
            </div>

            <div className={styles.studentsWorkspace}>
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

              <div className={styles.studentRoster}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.sectionLabel}>All students</p>
                    <h3>Roster</h3>
                  </div>
                  <p className={styles.sectionHint}>{students.length} total</p>
                </div>

                <div className={styles.studentCards}>
                  {students.length === 0 ? (
                    <p className={styles.emptyState}>No students available.</p>
                  ) : (
                    students.map((student) => {
                      const isSelected = student.id === selectedStudentId;

                      return (
                        <article
                          key={student.id}
                          className={`${styles.studentCard} ${isSelected ? styles.studentCardSelected : ""}`}
                        >
                          <button
                            type="button"
                            className={styles.studentCardBody}
                            onClick={() => setSelectedStudentId(student.id)}
                          >
                            <span className={styles.studentAvatar}>{student.fullName.slice(0, 1)}</span>
                            <span className={styles.studentCardText}>
                              <strong>{student.fullName}</strong>
                              <small>
                                {student.rollNumber} • Grade {student.gradeLevel} • Section {student.section}
                              </small>
                            </span>
                          </button>
                          <div className={styles.studentActions}>
                            {renderIconButton(`Select ${student.fullName}`, () => setSelectedStudentId(student.id), "select")}
                            {renderIconButton(`Edit ${student.fullName}`, () => onEditStudent(student), "edit")}
                            {renderIconButton(`Delete ${student.fullName}`, () => onDeleteStudent(student), "delete")}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
          )}

          {shouldRenderSection("marks") && (
          <section className={styles.panel} id="marks">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Assessment</p>
                <h2>Marks</h2>
              </div>
              <p className={styles.sectionHint}>Record test scores and adjust them later.</p>
            </div>

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
          </section>
          )}

          {shouldRenderSection("notes") && (
          <section className={styles.panel} id="notes">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Feedback</p>
                <h2>Notes</h2>
              </div>
              <p className={styles.sectionHint}>Add comments for student profiles.</p>
            </div>

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
          </section>
          )}

          {shouldRenderSection("homework") && (
          <section className={styles.panel} id="homework">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Assignments</p>
                <h2>Homework</h2>
              </div>
              <p className={styles.sectionHint}>Extend deadlines or remove stale tasks quickly.</p>
            </div>

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
              <div className={styles.inlineFields}>
                <input
                  placeholder="Homework title"
                  value={homeworkPayload.title}
                  onChange={(event) =>
                    setHomeworkPayload((prev) => ({ ...prev, title: event.target.value }))
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
              </div>
              <textarea
                placeholder="Homework description"
                value={homeworkPayload.description}
                onChange={(event) =>
                  setHomeworkPayload((prev) => ({ ...prev, description: event.target.value }))
                }
                required
              />
              <button disabled={loading} type="submit">
                Assign Homework
              </button>
            </form>
          </section>
          )}

          {shouldRenderSection("attendance") && (
          <section className={styles.panel} id="attendance">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Attendance</p>
                <h2>Daily Presence</h2>
              </div>
              <p className={styles.sectionHint}>Mark class attendance from the same screen.</p>
            </div>

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
              <div className={styles.inlineFields}>
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
              </div>
              <button disabled={loading} type="submit">
                Save Attendance
              </button>
            </form>
          </section>
          )}

          {shouldRenderSection("insights") && (
          <section className={`${styles.panel} ${styles.insightsPanel}`} id="insights">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Analytics</p>
                <h2>Class Insights</h2>
              </div>
              <p className={styles.sectionHint}>A compact summary of the whole class.</p>
            </div>

            {classAnalytics ? (
              <>
                <div className={styles.metricsGrid}>
                  <article>
                    <h4>Class Average</h4>
                    <p>{classAnalytics.classAverage}%</p>
                  </article>
                  <article>
                    <h4>Top Performer</h4>
                    <p>{classAnalytics.topPerformers[0]?.name || "N/A"}</p>
                  </article>
                  <article>
                    <h4>Absent Today</h4>
                    <p>{classAnalytics.absentToday.length}</p>
                  </article>
                  <article>
                    <h4>Missed Homework</h4>
                    <p>{classAnalytics.missedHomework.length}</p>
                  </article>
                </div>

                <div className={styles.analyticsGrid}>
                  <div className={styles.chartCard}>
                    <h3>Combined Student Performance</h3>
                    <div className={styles.tableWrap}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Average</th>
                            <th>Consistency</th>
                            <th>Attendance</th>
                            <th>Missed HW</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classAnalytics.studentPerformance.map((entry) => (
                            <tr key={entry.studentId}>
                              <td>
                                {entry.name}
                                <br />
                                <small>{entry.rollNumber}</small>
                              </td>
                              <td>{entry.average}%</td>
                              <td>{entry.consistency}%</td>
                              <td>{entry.attendanceRate}%</td>
                              <td>{entry.missedHomeworkCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={styles.listCard}>
                    <h3>Absent Today</h3>
                    {classAnalytics.absentToday.length === 0 ? (
                      <p>No absences recorded today.</p>
                    ) : (
                      classAnalytics.absentToday.map((entry) => (
                        <article key={`${entry.studentId}-${entry.date}`}>
                          <p>
                            <strong>{entry.name}</strong>
                          </p>
                          <small>{entry.rollNumber}</small>
                        </article>
                      ))
                    )}
                  </div>

                  <div className={styles.listCard}>
                    <h3>Missed Homework</h3>
                    {classAnalytics.missedHomework.length === 0 ? (
                      <p>No missed homework detected.</p>
                    ) : (
                      classAnalytics.missedHomework.map((homework) => (
                        <article key={homework.homeworkId}>
                          <p>
                            <strong>{homework.title}</strong>
                          </p>
                          <p>{homework.studentName}</p>
                          <small>
                            Due {new Date(homework.dueDate).toLocaleDateString()} | {homework.status}
                          </small>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p>Loading analytics...</p>
            )}
          </section>
          )}

          {shouldRenderSection("snapshot") && (
          <section className={styles.panelWide} id="snapshot">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Student profile</p>
                <h2>Student Snapshot</h2>
              </div>
              <p className={styles.sectionHint}>Charts, records, and item actions live here.</p>
            </div>

            <StudentProfilePanel
              profile={profile}
              mode="teacher"
              loading={loading}
              insightInput={insightInput}
              onInsightInputChange={setInsightInput}
              onGenerateInsights={onGenerateInsights}
              onEditMark={onEditMark}
              onDeleteMark={onDeleteMark}
              onEditNote={onEditNote}
              onDeleteNote={onDeleteNote}
              onEditHomework={onEditHomework}
              onDeleteHomework={onDeleteHomework}
              onMarkHomeworkStatus={markHomeworkStatus}
            />
          </section>
          )}
        </section>
      </main>
    </div>
  );
}
