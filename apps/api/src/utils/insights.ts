type StudentStats = {
  overallAverage: number;
  performanceStdDev: number;
  improvementRate: number;
  consistencyScore: number;
  subjectAverages: Array<{ subject: string; average: number }>;
};

type HomeworkInfo = {
  total: number;
  completed: number;
  overdue: number;
};

export const buildRecommendations = (
  stats: StudentStats,
  homework: HomeworkInfo,
  instruction?: string,
) => {
  const recommendations: string[] = [];

  if (stats.overallAverage < 55) {
    recommendations.push(
      "Focus on core concepts with 30-minute daily revision blocks and weekly checkpoint quizzes.",
    );
  } else if (stats.overallAverage < 75) {
    recommendations.push(
      "Use active recall for all weak topics and practice two timed tests per week.",
    );
  } else {
    recommendations.push(
      "Maintain momentum with mixed-difficulty practice and peer teaching once a week.",
    );
  }

  if (stats.improvementRate < 0) {
    recommendations.push(
      "Recent trend is declining. Schedule intervention: one teacher review session and a targeted practice sheet.",
    );
  } else if (stats.improvementRate > 1.2) {
    recommendations.push(
      "Trend is strongly positive. Increase challenge with advanced problem sets.",
    );
  }

  if (stats.performanceStdDev > 12) {
    recommendations.push(
      "Scores vary significantly between tests. Build a consistent weekly routine to stabilize outcomes.",
    );
  }

  const weakestSubject = stats.subjectAverages
    .slice()
    .sort((a, b) => a.average - b.average)[0];

  if (weakestSubject && weakestSubject.average < 65) {
    recommendations.push(
      `Prioritize ${weakestSubject.subject}: 3 focused sessions this week with solved examples and recap notes.`,
    );
  }

  if (homework.total > 0 && homework.completed / homework.total < 0.7) {
    recommendations.push(
      "Homework completion is below 70%. Use a daily to-do checklist and submit tasks before 8 PM.",
    );
  }

  if (homework.overdue > 0) {
    recommendations.push(
      "Clear overdue homework first. Start with shortest tasks to rebuild task completion momentum.",
    );
  }

  if (instruction) {
    recommendations.push(
      `Teacher note considered: ${instruction.slice(0, 160)}. Keep this aligned with weekly goals.`,
    );
  }

  return recommendations.slice(0, 6);
};
