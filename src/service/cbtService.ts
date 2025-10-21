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
      const submissionTime = new Date(examPaper.endTime.getTime() + gracePeriod);

      if (new Date() > submissionTime) {
        // Mock request and response objects
        const req: any = {
          params: { attemptId: attempt.id },
          user: { studentId: attempt.studentId },
        };
        const res: any = {
          status: (statusCode: number) => ({
            json: (data: any) => {
              logger.info(
                `Exam attempt ${attempt.id} auto-submitted successfully.`
              );
            },
          }),
        };
        const next = (error: any) => {
          logger.error(
            `Failed to auto-submit exam attempt ${attempt.id}`,
            error
          );
        };

        await submitExamAttempt(req, res, next);
      }
    }
  } catch (error) {
    logger.error("Failed to auto-submit CBT exams", error);
  }
};
