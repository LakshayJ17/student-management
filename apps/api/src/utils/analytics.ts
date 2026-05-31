type MarkPoint = {
  subject: string;
  score: number;
  maxScore: number;
  testDate: Date;
};

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

const stdDev = (values: number[]) => {
  if (values.length < 2) {
    return 0;
  }
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
};

const linearSlope = (values: number[]) => {
  const n = values.length;
  if (n < 2) {
    return 0;
  }

  const xMean = (n - 1) / 2;
  const yMean = mean(values);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i += 1) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  if (!denominator) {
    return 0;
  }

  return numerator / denominator;
};

export const buildStudentStats = (marks: MarkPoint[]) => {
  const percentages = marks.map((mark) =>
    mark.maxScore > 0 ? (mark.score / mark.maxScore) * 100 : 0,
  );

  const overallAverage = mean(percentages);
  const performanceStdDev = stdDev(percentages);
  const improvementRate = linearSlope(percentages);

  const consistencyScore = Math.max(
    0,
    Math.min(100, 100 - performanceStdDev * 1.25),
  );

  const subjectMap = new Map<
    string,
    {
      totalScore: number;
      totalMax: number;
    }
  >();

  marks.forEach((mark) => {
    const current = subjectMap.get(mark.subject) || {
      totalScore: 0,
      totalMax: 0,
    };

    current.totalScore += mark.score;
    current.totalMax += mark.maxScore;
    subjectMap.set(mark.subject, current);
  });

  const subjectAverages = Array.from(subjectMap.entries()).map(
    ([subject, totals]) => ({
      subject,
      average: totals.totalMax > 0 ? (totals.totalScore / totals.totalMax) * 100 : 0,
    }),
  );

  const trend = marks
    .slice()
    .sort((a, b) => a.testDate.getTime() - b.testDate.getTime())
    .map((mark) => ({
      subject: mark.subject,
      testDate: mark.testDate,
      percentage: mark.maxScore > 0 ? (mark.score / mark.maxScore) * 100 : 0,
    }));

  return {
    overallAverage,
    performanceStdDev,
    improvementRate,
    consistencyScore,
    subjectAverages,
    trend,
  };
};
