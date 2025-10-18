import { NextFunction, Request, Response } from "express";
import prisma from "../../prisma";
import { handleError } from "../../error/errorHandler";
import logger from "../../utils/logger";
import { getStaffInfoFromRequest } from "../../function/schoolFunctions";

/**
 * Add or update marks for multiple students for a single exam paper and optionally psychomotor assessments.
 * @route POST /api/results/manual-entry
 */
export const addManualMarks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      examPaperId,
      studentMarks, // Expected: [{ studentId, marksObtained, teacherRemark, psychomotorAssessments }]
      termId,
      sessionId,
    } = req.body;

    const staffInfo = await getStaffInfoFromRequest(req, res);
    if (!staffInfo) return;

    // Validate examPaperId
    if (!examPaperId) {
      return handleError(res, "examPaperId is required.", 400);
    }

    // Validate studentMarks array
    if (!Array.isArray(studentMarks) || studentMarks.length === 0) {
      return handleError(res, "studentMarks must be a non-empty array.", 400);
    }

    // Verify exam paper exists
    const examPaper = await prisma.examPaper.findUnique({
      where: { id: examPaperId },
    });

    if (!examPaper) {
      return handleError(res, "Exam paper not found.", 404);
    }

    await prisma.$transaction(async (tx) => {
      for (const entry of studentMarks) {
        const {
          studentId,
          marksObtained,
          teacherRemark,
          psychomotorAssessments,
        } = entry;

        if (!studentId || marksObtained === undefined) {
          throw new Error(
            "Each entry must include studentId and marksObtained."
          );
        }

        // 1. Upsert exam attempt
        await tx.examAttempt.upsert({
          where: {
            examPaperId_studentId: { examPaperId, studentId },
          },
          update: {
            totalScore: marksObtained,
            status: "Graded",
          },
          create: {
            examPaperId,
            studentId,
            totalScore: marksObtained,
            status: "Graded",
          },
        });

        // 2. Upsert academic results
        await tx.result.upsert({
          where: {
            studentId_examPaperId: { studentId, examPaperId },
          },
          update: { marksObtained, teacherRemark },
          create: {
            studentId,
            examPaperId,
            marksObtained,
            teacherRemark,
          },
        });

        // 3. Process psychomotor assessments if provided for this student
        if (psychomotorAssessments && Array.isArray(psychomotorAssessments)) {
          if (!termId || !sessionId) {
            throw new Error(
              "termId and sessionId are required when providing psychomotor assessments."
            );
          }

          for (const assessment of psychomotorAssessments) {
            const { skillId, rating } = assessment;
            if (!skillId || rating === undefined) {
              throw new Error(
                "Each psychomotor assessment must include a skillId and a rating."
              );
            }

            await tx.studentPsychomotorAssessment.upsert({
              where: {
                studentId_skillId_termId_sessionId: {
                  studentId,
                  skillId,
                  termId,
                  sessionId,
                },
              },
              update: { rating, assessedById: staffInfo.staffId! },
              create: {
                studentId,
                skillId,
                termId,
                sessionId,
                rating,
                assessedById: staffInfo.staffId!,
              },
            });
          }
        }
      }
    });

    const studentIds = studentMarks.map((m) => m.studentId);
    logger.info(
      { examPaperId, studentIds, staffId: staffInfo.staffId },
      "Manual marks and/or psychomotor assessments added successfully."
    );

    res.status(201).json({
      success: true,
      message: "Data saved successfully.",
      data: studentIds.length,
    });
  } catch (error: any) {
    if (
      error.message.includes("termId and sessionId are required") ||
      error.message.includes("must include a skillId and a rating") ||
      error.message.includes("studentMarks must be a non-empty array") ||
      error.message.includes("must include studentId and marksObtained")
    ) {
      return handleError(res, error.message, 400);
    }
    logger.error(error, "Failed to add manual marks and/or psychomotor");
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
        responses: true,
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
      const allCbtGraded = attempt.responses.every(
        (r) => r.marksAwarded !== null
      );
      if (!allCbtGraded) {
        return handleError(
          res,
          `Cannot finalize results. Attempt ID ${attempt.id} has ungraded CBT questions.`,
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

    await prisma.examPaper.update({
      where: { id: examPaperId },
      data: { isResultPublished: publish },
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
