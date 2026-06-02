"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../app/page.module.css";
import { StudentLite, StudentProfile, request } from "../lib/dashboard";
import { StudentProfilePanel } from "./student-profile-panel";

export default function StudentDashboard() {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [error, setError] = useState("");

  const refreshStudents = useCallback(async () => {
    const data = await request<StudentLite[]>("/api/students");
    setStudents(data);

    if (!selectedStudentId && data.length > 0) {
      setSelectedStudentId(data[0].id);
    }
  }, [selectedStudentId]);

  const refreshStudentProfile = useCallback(async (studentId: number) => {
    const data = await request<StudentProfile>(`/api/students/${studentId}/profile`);
    setProfile(data);
  }, []);

  useEffect(() => {
    refreshStudents().catch((fetchError: Error) => setError(fetchError.message));
  }, [refreshStudents]);

  useEffect(() => {
    if (!selectedStudentId) {
      return;
    }

    refreshStudentProfile(selectedStudentId).catch((fetchError: Error) => {
      setError(fetchError.message);
    });
  }, [refreshStudentProfile, selectedStudentId]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>StudentPulse Platform</p>
        <h1>All Students Dashboard</h1>
        <p>
          Browse every student profile without signing in. Select a student to review marks,
          homework, attendance, and recommendations.
        </p>
      </header>

      <main className={styles.mainGrid}>
        <section className={styles.panel}>
          <h2>Select Student</h2>
          <label className={styles.selectWrap}>
            Student
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

          {error && <p className={styles.error}>{error}</p>}
        </section>

        <section className={styles.panelWide}>
          <h2>Performance Overview</h2>
          <StudentProfilePanel profile={profile} mode="student" loading={false} />
        </section>
      </main>
    </div>
  );
}
