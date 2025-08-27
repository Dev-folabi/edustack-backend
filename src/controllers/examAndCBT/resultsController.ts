import { NextFunction, Request, Response } from "express";
import prisma from "../../prisma";
import { handleError } from "../../error/errorHandler";
import logger from "../../utils/logger";

/**
 * Add or update marks for a paper-based exam for a single student.
 * @route POST /api/results/manual-entry
 */
export const addManualMarks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId, examPaperId, marksObtained, teacherRemark } = req.body;

    const examPaper = await prisma.examPaper.findUnique({
      where: { id: examPaperId },
    });
    if (!examPaper) {
      return handleError(res, "Exam paper not found.", 404);
    }
    if (examPaper.mode !== "PaperBased") {
      return handleError(res, "This is only for paper-based exams.", 400);
    }

    const result = await prisma.result.upsert({
      where: {
        studentId_examPaperId: {
          studentId,
          examPaperId,
        },
      },
      update: {
        marksObtained,
        teacherRemark,
      },
      create: {
        studentId,
        examPaperId,
        marksObtained,
        teacherRemark,
      },
    });

    logger.info(
      { resultId: result.id, studentId, examPaperId },
      "Manual marks added successfully."
    );

    res.status(201).json({
      success: true,
      message: "Marks added successfully.",
      data: result,
    });
  } catch (error) {
    logger.error(error, "Failed to add manual marks");
    next(error);
  }
};

/**
 * Add class teacher and school head remarks for a student's term enrollment.
 * @route POST /api/results/term-remarks
 */
export const addTermRemarks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      studentId,
      termId,
      sessionId,
      classTeacherRemark,
      schoolHeadRemark,
    } = req.body;

    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId,
        termId,
        sessionId,
      },
    });

    if (!enrollment) {
      return handleError(
        res,
        "Student enrollment for the specified term/session not found.",
        404
      );
    }

    const updatedEnrollment = await prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        classTeacherRemark,
        schoolHeadRemark,
      },
    });

    logger.info(
      { enrollmentId: updatedEnrollment.id },
      "Term remarks added successfully."
    );

    res.status(200).json({
      success: true,
      message: "Term remarks saved successfully.",
      data: updatedEnrollment,
    });
  } catch (error) {
    logger.error(error, "Failed to add term remarks");
    next(error);
  }
};

/**
 * Finalize the results for a CBT exam paper after all manual grading is complete.
 * This transfers the final scores from ExamAttempt to the main Result table.
 * @route POST /api/results/finalize-cbt/:examPaperId
 */
export const finalizeCbtResults = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { examPaperId } = req.params;

    const attempts = await prisma.examAttempt.findMany({
      where: {
        examPaperId: examPaperId,
        status: "Submitted",
      },
      include: {
        responses: {
          where: {
            question: { type: "Essay" },
          },
        },
      },
    });

    if (!attempts.length) {
      return handleError(
        res,
        "No submitted attempts found to finalize for this exam paper.",
        404
      );
    }

    const resultsToCreate = [] as any;
    const attemptsToUpdate = [] as any;

    for (const attempt of attempts) {
      const allEssaysGraded = attempt.responses.every(
        (r) => r.marksAwarded !== null
      );
      if (!allEssaysGraded) {
        return handleError(
          res,
          `Cannot finalize results. Attempt ID ${attempt.id} has ungraded essay questions.`,
          400
        );
      }

      resultsToCreate.push({
        studentId: attempt.studentId,
        examPaperId: attempt.examPaperId,
        marksObtained: attempt.totalScore || 0,
      });

      attemptsToUpdate.push(
        prisma.examAttempt.update({
          where: { id: attempt.id },
          data: { status: "Graded" },
        })
      );
    }

    await prisma.$transaction([
      prisma.result.createMany({
        data: resultsToCreate,
        skipDuplicates: true,
      }),
      ...attemptsToUpdate,
    ]);

    logger.info(
      { examPaperId, count: resultsToCreate.length },
      "CBT results finalized successfully."
    );

    res.status(200).json({
      success: true,
      message: `${resultsToCreate.length} CBT result(s) have been finalized.`,
    });
  } catch (error) {
    logger.error(error, "Failed to finalize CBT results");
    next(error);
  }
};

/**
 * Publish or unpublish all results for a given exam paper.
 * @route POST /api/results/publish/:examPaperId
 */
export const publishResults = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { examPaperId } = req.params;
    const { publish } = req.body;

    if (typeof publish !== "boolean") {
      return handleError(
        res,
        "The 'publish' field must be a boolean value.",
        400
      );
    }

    const { count } = await prisma.result.updateMany({
      where: { examPaperId: examPaperId },
      data: { isPublished: publish },
    });

    logger.info(
      { examPaperId, published: publish, count },
      "Results publication status changed."
    );

    res.status(200).json({
      success: true,
      message: `Successfully ${publish ? "published" : "unpublished"} ${count} result(s).`,
    });
  } catch (error) {
    logger.error(error, "Failed to publish results");
    next(error);
  }
};

/**
 * Get all essay responses for a given exam paper that need manual grading.
 * @route GET /api/results/essays-for-grading/:examPaperId
 */
export const getEssayResponsesForGrading = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { examPaperId } = req.params;

    const responses = await prisma.examResponse.findMany({
      where: {
        attempt: {
          examPaperId: examPaperId,
        },
        question: {
          type: "Essay",
        },
      },
      include: {
        question: {
          select: {
            questionText: true,
            marks: true,
          },
        },
        attempt: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Essay responses fetched successfully.",
      data: responses,
    });
  } catch (error) {
    logger.error(error, "Failed to fetch essay responses for grading");
    next(error);
  }
};

/**
 * Submit a grade for a single essay response.
 * @route POST /api/results/grade-essay/:responseId
 */
export const gradeEssayResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { responseId } = req.params;
    const { marksAwarded } = req.body;

    const response = await prisma.examResponse.findUnique({
      where: { id: responseId },
      include: { question: true, attempt: true },
    });

    if (!response) {
      return handleError(res, "Exam response not found.", 404);
    }
    if (response.question.type !== "Essay") {
      return handleError(
        res,
        "This response is not for an essay question.",
        400
      );
    }
    if (marksAwarded > response.question.marks) {
      return handleError(
        res,
        `Marks awarded (${marksAwarded}) cannot exceed the maximum marks for the question (${response.question.marks}).`,
        400
      );
    }

    // This logic assumes we are grading for the first time.
    // A more robust implementation would handle re-grading by subtracting the old score.
    await prisma.$transaction([
      prisma.examResponse.update({
        where: { id: responseId },
        data: { marksAwarded, isCorrect: marksAwarded > 0 ? true : false }, // Mark as correct if marks are given
      }),
      prisma.examAttempt.update({
        where: { id: response.attemptId },
        data: {
          totalScore: {
            increment: marksAwarded,
          },
        },
      }),
    ]);

    logger.info(
      { responseId, marksAwarded },
      "Essay response graded successfully."
    );

    res.status(200).json({
      success: true,
      message: "Essay graded and score updated successfully.",
    });
  } catch (error) {
    logger.error(error, "Failed to grade essay response");
    next(error);
  }
};
