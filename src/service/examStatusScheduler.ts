import prisma from "../prisma";
import logger from "../utils/logger";

/**
 * Transitions scheduled exams to ongoing.
 */
export const transitionScheduledToOngoing = async () => {
  const now = new Date();
  try {
    const examsToStart = await prisma.exam.findMany({
      where: {
        status: "Scheduled",
        startDate: {
          lte: now,
        },
      },
    });

    if (examsToStart) {
      for (const exam of examsToStart) {
        await prisma.exam.update({
          where: { id: exam.id },
          data: { status: "Ongoing" },
        });
        logger.info(`Exam ${exam.id} has started and is now Ongoing.`);
      }
    } else {
      logger.info("No exams to start at this moment.");
    }
  } catch (error) {
    logger.error({ err: error }, "Error transitioning scheduled exams to ongoing:");
  }
};

/**
 * Transitions ongoing exams to completed.
 */
export const transitionOngoingToCompleted = async () => {
  const now = new Date();
  try {
    const examsToComplete = await prisma.exam.findMany({
      where: {
        status: "Ongoing",
        endDate: {
          lte: now,
        },
      },
    });

    if (examsToComplete) {
      for (const exam of examsToComplete) {
        await prisma.exam.update({
          where: { id: exam.id },
          data: { status: "Completed" },
        });
        logger.info(`Exam ${exam.id} has ended and is now Completed.`);
      }
    } else {
      logger.info("No exams to complete at this moment.");
    }
  } catch (error) {
    logger.error({ err: error }, "Error transitioning ongoing exams to completed:");
  }
};
