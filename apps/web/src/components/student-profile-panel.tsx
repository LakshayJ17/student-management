"use client";

import { useMemo } from "react";
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
import styles from "../app/page.module.css";
import type { StudentProfile } from "../lib/dashboard";

const HOMEWORK_COLORS = ["#0a6c74", "#e67e22", "#d97706"];

type StudentProfilePanelProps = {
  profile: StudentProfile | null;
  mode: "teacher" | "student";
  loading: boolean;
  insightInput?: string;
  onInsightInputChange?: (value: string) => void;
  onGenerateInsights?: () => void;
  onEditMark?: (mark: StudentProfile["marks"][number]) => void;
  onDeleteMark?: (mark: StudentProfile["marks"][number]) => void;
  onEditNote?: (note: StudentProfile["notes"][number]) => void;
  onDeleteNote?: (note: StudentProfile["notes"][number]) => void;
  onEditHomework?: (homework: StudentProfile["homeworks"][number]) => void;
  onDeleteHomework?: (homework: StudentProfile["homeworks"][number]) => void;
  onMarkHomeworkStatus?: (homeworkId: number, status: "COMPLETED" | "OVERDUE") => void;
};

export function StudentProfilePanel({
  profile,
  mode,
  loading,
  insightInput,
  onInsightInputChange,
  onGenerateInsights,
  onEditMark,
  onDeleteMark,
  onEditNote,
  onDeleteNote,
  onEditHomework,
  onDeleteHomework,
  onMarkHomeworkStatus,
}: StudentProfilePanelProps) {
  const homeworkChartData = useMemo(() => {
    if (!profile) {
      return [];
    }

    return [
      {
        name: "Pending",
        value: profile.homeworks.filter((homework) => homework.status === "PENDING").length,
      },
      {
        name: "Completed",
        value: profile.homeworks.filter((homework) => homework.status === "COMPLETED").length,
      },
      {
        name: "Overdue",
        value: profile.homeworks.filter((homework) => homework.status === "OVERDUE").length,
      },
    ];
  }, [profile]);

  if (!profile) {
    return <p>No student profile selected.</p>;
  }

  return (
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
              <Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleString()} />
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
          <h3>Marks</h3>
          {profile.marks.map((mark) => {
            const percentage = mark.maxScore > 0 ? (mark.score / mark.maxScore) * 100 : 0;

            return (
              <article key={mark.id}>
                <p>
                  <strong>{mark.subject}</strong>
                </p>
                <p>
                  {mark.score}/{mark.maxScore} ({percentage.toFixed(1)}%)
                </p>
                <small>{new Date(mark.testDate).toLocaleString()}</small>
                {mode === "teacher" && (onEditMark || onDeleteMark) && (
                  <div className={styles.inlineButtons}>
                    {onEditMark && (
                      <button type="button" onClick={() => onEditMark(mark)}>
                        Edit
                      </button>
                    )}
                    {onDeleteMark && (
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => onDeleteMark(mark)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className={styles.listCard}>
          <h3>{mode === "teacher" ? "Teacher Notes" : "Notes"}</h3>
          {profile.notes.map((note) => (
            <article key={note.id}>
              <p>{note.content}</p>
              <small>{new Date(note.createdAt).toLocaleString()}</small>
              {mode === "teacher" && (onEditNote || onDeleteNote) && (
                <div className={styles.inlineButtons}>
                  {onEditNote && (
                    <button type="button" onClick={() => onEditNote(note)}>
                      Edit
                    </button>
                  )}
                  {onDeleteNote && (
                    <button type="button" className={styles.ghost} onClick={() => onDeleteNote(note)}>
                      Delete
                    </button>
                  )}
                </div>
              )}
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
              {mode === "teacher" && onMarkHomeworkStatus && (
                <div className={styles.inlineButtons}>
                  <button type="button" onClick={() => onMarkHomeworkStatus(homework.id, "COMPLETED")}>
                    Mark Complete
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => onMarkHomeworkStatus(homework.id, "OVERDUE")}
                  >
                    Mark Overdue
                  </button>
                  {onEditHomework && (
                    <button type="button" onClick={() => onEditHomework(homework)}>
                      Edit
                    </button>
                  )}
                  {onDeleteHomework && (
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => onDeleteHomework(homework)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className={styles.panelInset}>
        <h3>AI Improvement Recommendations</h3>
        {mode === "teacher" && (
          <>
            <textarea
              value={insightInput}
              onChange={(event) => onInsightInputChange?.(event.target.value)}
              placeholder="Optional instruction (example: focus on math and attendance this month)"
            />
            <button type="button" onClick={onGenerateInsights} disabled={loading}>
              Refresh Recommendations
            </button>
          </>
        )}
        <ul className={styles.recoList}>
          {profile.recommendations.map((recommendation) => (
            <li key={recommendation}>{recommendation}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
