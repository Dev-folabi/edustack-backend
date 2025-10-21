import prisma from "../prisma";
import logger from "../utils/logger";
import { submitExamAttempt } from "../controllers/examAndCBT/cbtController";

export const autoSubmitCbtExams = async () => {
  try {
    const inProgressExams = await prisma.examAttempt.findMany({
      where: {
        status: "InProgress",
        examPaper: {
          mode: "CBT",
        },
      },
      include: {
        examPaper: true,
        student: {
          include: {
            user: true,
          },
        },
      },
    });

    for (const attempt of inProgressExams) {
      const { examPaper } = attempt;
      const gracePeriod = 10 * 60 * 1000; // 10 minutes in milliseconds
      const submissionTime = new Date(
        examPaper.endTime.getTime() + gracePeriod
      );

      if (new Date() > submissionTime) {
        const responses = await prisma.examResponse.findMany({
          where: { attemptId: attempt.id },
          include: { question: true },
          take: attempt.examPaper.totalQuestions ?? undefined,
          orderBy: {
            createdAt: "desc",
          },
        });

        let totalScore = 0;
        const gradingUpdates: any[] = [];

        for (const response of responses) {
          const { question, studentAnswer } = response;
          let isCorrect: boolean | null = null;
          let marksAwarded = 0;

          if (question.type === "MCQ" || question.type === "TrueFalse") {
            isCorrect =
              JSON.stringify(studentAnswer) ===
              JSON.stringify(question.correctAnswer);
            if (isCorrect) {
              marksAwarded = question.marks;
              totalScore += marksAwarded;
            }
          } else if (question.type === "FillInBlanks") {
            isCorrect =
              (studentAnswer as string).toLowerCase() ===
              (question.correctAnswer as string).toLowerCase();
            if (isCorrect) {
              marksAwarded = question.marks;
              totalScore += marksAwarded;
            }
          }

          gradingUpdates.push(
            prisma.examResponse.update({
              where: { id: response.id },
              data: { isCorrect, marksAwarded },
            })
          );
        }

        await prisma.$transaction([
          ...gradingUpdates,
          prisma.examAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "Submitted",
              submittedAt: new Date(),
              totalScore: totalScore,
            },
          }),
        ]);

        logger.info(
          `${attempt.id},
          Exam attempt submitted and auto-graded successfully.`
        );
      }
    }
  } catch (error) {
    logger.error("Failed to auto-submit CBT exams", error);
  }
};
