import { NextFunction, Request, Response } from "express";
import prisma from "../../prisma";
import { handleError } from "../../error/errorHandler";
import logger from "../../utils/logger";
import { getStudentInfoFromRequest } from "../../function/schoolFunctions";

// A shuffle algorithm
const shuffleArray = (array: any[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * Start an Exam Attempt for a CBT paper.
 * If an attempt already exists and is in progress, it returns the existing data.
 * If the attempt is submitted, it blocks access.
 * If no attempt exists, it creates a new one.
 * @route POST /api/cbt/attempts/start
 */
export const startExamAttempt = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { examPaperId } = req.body;
    const studentInfo = await getStudentInfoFromRequest(req, res);
    if (!studentInfo) return;
    const { studentId } = studentInfo;

    const examPaper = await prisma.examPaper.findUnique({
      where: { id: examPaperId },
      include: { exam: true },
    });

    if (!examPaper) {
      return handleError(res, "Exam paper not found.", 404);
    }
    if (examPaper.mode !== "CBT") {
      return handleError(
        res,
        "This exam paper is not a Computer-Based Test.",
        400
      );
    }
    if (!examPaper.questionBankId) {
      return handleError(res, "This CBT paper has no linked question.", 500);
    }

    const now = new Date();
    // if (now < examPaper.startTime || now > examPaper.endTime) {
    //   return handleError(res, "This exam is not currently active.", 400);
    // }

    let attempt = await prisma.examAttempt.findUnique({
      where: { examPaperId_studentId: { examPaperId, studentId } },
    });

    if (attempt) {
      if (attempt.status === "Submitted" || attempt.status === "Graded") {
        return handleError(res, "You have already submitted this exam.", 400);
      }
    } else {
      attempt = await prisma.examAttempt.create({
        data: {
          examPaperId,
          studentId,
          startedAt: now,
          status: "InProgress",
        },
      });
    }

    let questions = await prisma.question.findMany({
      where: { bankId: examPaper.questionBankId },
      select: {
        id: true,
        type: true,
        questionText: true,
        options: true,
        marks: true,
      },
    });

    if (
      examPaper.totalQuestions &&
      examPaper.totalQuestions > 0 &&
      examPaper.totalQuestions < questions.length
    ) {
      questions = shuffleArray(questions).slice(0, examPaper.totalQuestions);
    } else {
      questions = shuffleArray(questions);
    }

    logger.info(
      { attemptId: attempt.id, studentId },
      "Student started or resumed exam attempt."
    );

    res.status(201).json({
      success: true,
      message: "Exam attempt started successfully.",
      data: {
        examPaper,
        attempt,
        questions,
      },
    });
  } catch (error) {
    logger.error(error, "Failed to start exam attempt");
    next(error);
  }
};

/**
 * Submit an exam attempt.
 * This triggers the auto-grading process for objective questions.
 * @route POST /api/cbt/attempts/:attemptId/submit
 */
export const submitExamAttempt = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attemptId } = req.params;
    const studentInfo = await getStudentInfoFromRequest(req, res);
    if (!studentInfo) return;

    const attempt = await prisma.examAttempt.findFirst({
      where: {
        id: attemptId,
        studentId: studentInfo.studentId,
      },
    });

    if (!attempt) {
      return handleError(
        res,
        "Exam attempt not found or you are not authorized to access it.",
        404
      );
    }
    if (attempt.status !== "InProgress") {
      return handleError(
        res,
        `Cannot submit exam, status is already '${attempt.status}'.`,
        400
      );
    }

    const responses = await prisma.examResponse.findMany({
      where: { attemptId: attemptId },
      include: { question: true },
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
        where: { id: attemptId },
        data: {
          status: "Submitted",
          submittedAt: new Date(),
          totalScore: totalScore,
        },
      }),
    ]);

    logger.info(
      { attemptId },
      "Exam attempt submitted and auto-graded successfully."
    );

    res.status(200).json({
      success: true,
      message: "Exam submitted successfully.",
      data: {
        attemptId,
        totalScore,
      },
    });
  } catch (error) {
    logger.error(error, "Failed to submit exam attempt");
    next(error);
  }
};

/**
 * Save a student's multiple response to a question.
 * Uses upsert for auto-save functionality.
 * @route POST /api/cbt/attempts/:attemptId/responses
 */
export const saveExamResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attemptId } = req.params;
    const { responses } = req.body;

    if (!Array.isArray(responses)) {
      return handleError(res, "Responses must be provided as an array", 400);
    }

    const studentInfo = await getStudentInfoFromRequest(req, res);
    if (!studentInfo) return;

    const attempt = await prisma.examAttempt.findFirst({
      where: {
        id: attemptId,
        studentId: studentInfo.studentId,
      },
      include: {
        examPaper: true,
      },
    });

    if (!attempt) {
      return handleError(
        res,
        "Exam attempt not found or you are not authorized to access it.",
        404
      );
    }

    if (attempt.status !== "InProgress") {
      return handleError(
        res,
        `Cannot save answers, exam status is '${attempt.status}'.`,
        400
      );
    }

    const now = new Date();
    if (now > attempt.examPaper.endTime) {
      return handleError(
        res,
        "Exam time is over. Cannot save new answers.",
        400
      );
    }

    // Process all responses in a transaction
    const savedResponses = await prisma.$transaction(
      responses.map(({ questionId, studentAnswer }) =>
        prisma.examResponse.upsert({
          where: {
            attemptId_questionId: {
              attemptId,
              questionId,
            },
          },
          update: {
            studentAnswer,
          },
          create: {
            attemptId,
            questionId,
            studentAnswer,
          },
        })
      )
    );

    res.status(200).json({
      success: true,
      message: "Answers saved successfully.",
      data: {
        savedResponses: savedResponses.map((response) => ({
          responseId: response.id,
          questionId: response.questionId,
        })),
        savedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error(error, "Failed to save exam responses");
    next(error);
  }
};
