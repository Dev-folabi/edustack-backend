import prisma from "../prisma";
import logger from "../utils/logger";

/**
 * Transitions all currently enrolled students to a newly activated term.
 * Creates new StudentEnrollment records for students with status "enrolled"
 * while preserving their class and section assignments.
 *
 * @param termId - The ID of the newly activated term
 * @returns Object containing counts of successful transitions and errors
 */
export const transitionStudentsToNewTerm = async (termId: string) => {
  try {
    // Get the term with its session
    const term = await prisma.term.findUnique({
      where: { id: termId },
      include: { session: true },
    });

    if (!term) {
      logger.error({ termId }, "Term not found for student transition");
      return { success: false, error: "Term not found" };
    }

    // Find all students currently enrolled (status = "enrolled")
    // We only want one enrollment per student (the most recent one)
    const currentEnrollments = await prisma.studentEnrollment.findMany({
      where: {
        status: "enrolled",
        sessionId: term.sessionId, // Same session
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            schoolId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Group by studentId to get only the most recent enrollment per student
    const uniqueEnrollments = new Map<string, (typeof currentEnrollments)[0]>();
    for (const enrollment of currentEnrollments) {
      if (!uniqueEnrollments.has(enrollment.studentId)) {
        uniqueEnrollments.set(enrollment.studentId, enrollment);
      }
    }

    const enrollmentsToProcess = Array.from(uniqueEnrollments.values());

    if (enrollmentsToProcess.length === 0) {
      logger.info(
        { termId, sessionId: term.sessionId },
        "No students to transition to new term"
      );
      return {
        success: true,
        transitioned: 0,
        skipped: 0,
        errors: 0,
      };
    }

    let transitionedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each enrollment
    for (const enrollment of enrollmentsToProcess) {
      try {
        // Check if student already has an enrollment for this term
        const existingEnrollment = await prisma.studentEnrollment.findFirst({
          where: {
            studentId: enrollment.studentId,
            termId: termId,
            sessionId: term.sessionId,
          },
        });

        if (existingEnrollment) {
          logger.debug(
            {
              studentId: enrollment.studentId,
              termId,
              existingEnrollmentId: existingEnrollment.id,
            },
            "Student already has enrollment for this term, skipping"
          );
          skippedCount++;
          continue;
        }

        // Create new enrollment for the new term
        await prisma.studentEnrollment.create({
          data: {
            studentId: enrollment.studentId,
            classId: enrollment.classId,
            sectionId: enrollment.sectionId,
            sessionId: term.sessionId,
            termId: termId,
            status: "enrolled",
          },
        });

        transitionedCount++;
        logger.debug(
          {
            studentId: enrollment.studentId,
            studentName: enrollment.student.name,
            termId,
            classId: enrollment.classId,
            sectionId: enrollment.sectionId,
          },
          "Student transitioned to new term"
        );
      } catch (error: any) {
        errorCount++;
        logger.error(
          {
            err: error,
            studentId: enrollment.studentId,
            termId,
          },
          "Failed to transition student to new term"
        );
      }
    }

    logger.info(
      {
        termId,
        termName: term.name,
        sessionId: term.sessionId,
        transitioned: transitionedCount,
        skipped: skippedCount,
        errors: errorCount,
        total: enrollmentsToProcess.length,
      },
      "Completed student transition to new term"
    );

    return {
      success: true,
      transitioned: transitionedCount,
      skipped: skippedCount,
      errors: errorCount,
      total: enrollmentsToProcess.length,
    };
  } catch (error: any) {
    logger.error(
      { err: error, termId },
      "Critical error during student term transition"
    );
    return {
      success: false,
      error: error.message,
      transitioned: 0,
      skipped: 0,
      errors: 0,
    };
  }
};
