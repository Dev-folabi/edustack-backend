import { NextFunction, Request, Response } from "express";
import prisma from "../../prisma";
import { handleError } from "../../error/errorHandler";
import logger from "../../utils/logger";
import { getStaffInfoFromRequest } from "../../function/schoolFunctions";

/**
 * Create a new Exam
 * @route POST /api/exams
 */
export const createExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const staffInfo = await getStaffInfoFromRequest(req, res);
    if (!staffInfo) return;

    const {
      title,
      startDate,
      endDate,
      classId,
      sectionId,
      termId,
      sessionId,
      schoolId,
    } = req.body;

    const newExam = await prisma.exam.create({
      data: {
        title,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        classId,
        sectionId,
        termId,
        sessionId,
        schoolId,
        ...(staffInfo.role === "STAFF" && { createdById: staffInfo.staffId! }),
      },
    });

    logger.info(
      { examId: newExam.id, createdBy: staffInfo.staffId },
      "Exam created successfully."
    );

    res.status(201).json({
      success: true,
      message: "Exam created successfully.",
      data: newExam,
    });
  } catch (error) {
    logger.error(error, "Failed to create exam");
    next(error);
  }
};

/**
 * Get all Exam Papers for a term/session
 * @route GET /api/papers/by-term-session
 */
export const getExamPapersByTermAndSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { termId, sessionId } = req.query;

    if (!termId || !sessionId) {
      return handleError(
        res,
        "termId and sessionId are required query parameters.",
        400
      );
    }

    const papers = await prisma.examPaper.findMany({
      where: {
        exam: {
          termId: termId as string,
          sessionId: sessionId as string,
        },
      },
      include: {
        subject: true,
        exam: {
          select: {
            title: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
      orderBy: {
        paperDate: "asc",
      },
    });

    res.status(200).json({
      success: true,
      message: "Exam papers fetched successfully.",
      data: papers,
    });
  } catch (error) {
    logger.error(error, "Failed to fetch exam papers");
    next(error);
  }
};

/**
 * Get Exam Timetable for a class/section
 * @route GET /api/exams/timetable
 */
export const getExamTimetable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { classId, sectionId, sessionId, termId } = req.query;

    if (!classId || !sessionId || !termId) {
      return handleError(
        res,
        "classId, sessionId, and termId are required.",
        400
      );
    }

    const timetable = await prisma.examTimetable.findMany({
      where: {
        classId: classId as string,
        sectionId: sectionId ? (sectionId as string) : undefined,
        sessionId: sessionId as string,
        termId: termId as string,
      },
      include: {
        examPaper: {
          include: {
            subject: true,
            exam: {
              select: {
                title: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
      orderBy: {
        examPaper: {
          paperDate: "asc",
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Exam timetable fetched successfully.",
      data: timetable,
    });
  } catch (error) {
    logger.error(error, "Failed to fetch exam timetable");
    next(error);
  }
};

/**
 * Add a paper to an existing Exam
 * @route POST /api/exams/:examId/papers
 */
export const addExamPaper = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { examId } = req.params;
    const {
      subjectId,
      maxMarks,
      paperDate,
      startTime,
      endTime,
      mode,
      questionBankId,
      totalQuestions,
    } = req.body;

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      return handleError(res, "Exam not found, cannot add paper.", 404);
    }

    if (mode === "CBT" && !questionBankId) {
      return handleError(
        res,
        "A Question Bank must be linked for CBT exams.",
        400
      );
    }

    const newPaper = await prisma.$transaction(async (tx) => {
      const paper = await tx.examPaper.create({
        data: {
          examId,
          subjectId,
          maxMarks,
          paperDate: new Date(paperDate),
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          mode,
          ...(questionBankId && { questionBankId }),
          ...(totalQuestions && { totalQuestions }),
        },
      });

      await tx.examTimetable.create({
        data: {
          examPaperId: paper.id,
          classId: exam.classId,
          sectionId: exam.sectionId,
          termId: exam.termId,
          sessionId: exam.sessionId,
        },
      });

      return paper;
    });

    logger.info(
      { paperId: newPaper.id, examId },
      "Exam paper and timetable entry added successfully."
    );

    res.status(201).json({
      success: true,
      message: "Exam paper added successfully.",
      data: newPaper,
    });
  } catch (error) {
    logger.error(error, "Failed to add exam paper");
    next(error);
  }
};

/**
 * Update an Exam Paper
 * @route PUT /api/exams/:examId/papers/:paperId
 */
export const updateExamPaper = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { paperId } = req.params;
    const {
      maxMarks,
      paperDate,
      startTime,
      endTime,
      mode,
      questionBankId,
      totalQuestions,
    } = req.body;

    const existingPaper = await prisma.examPaper.findUnique({
      where: { id: paperId },
    });
    if (!existingPaper) {
      return handleError(res, "Exam paper not found.", 404);
    }

    const updatedPaper = await prisma.examPaper.update({
      where: { id: paperId },
      data: {
        maxMarks,
        paperDate: paperDate ? new Date(paperDate) : undefined,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        mode,
        ...(questionBankId && { questionBankId }),
        ...(totalQuestions && { totalQuestions }),
      },
    });

    logger.info(
      { paperId: updatedPaper.id },
      "Exam paper updated successfully."
    );

    res.status(200).json({
      success: true,
      message: "Exam paper updated successfully.",
      data: updatedPaper,
    });
  } catch (error) {
    logger.error(error, "Failed to update exam paper");
    next(error);
  }
};

/**
 * Delete an Exam Paper
 * @route DELETE /api/exams/:examId/papers/:paperId
 */
export const deleteExamPaper = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { paperId } = req.params;

    const attempts = await prisma.examAttempt.count({
      where: { examPaperId: paperId },
    });

    if (attempts > 0) {
      return handleError(
        res,
        "Cannot delete paper, students have already attempted it.",
        400
      );
    }

    await prisma.$transaction([
      prisma.examTimetable.deleteMany({
        where: { examPaperId: paperId },
      }),
      prisma.examPaper.delete({
        where: { id: paperId },
      }),
    ]);

    logger.info(
      { paperId },
      "Exam paper and timetable entry deleted successfully."
    );

    res.status(200).json({
      success: true,
      message: "Exam paper deleted successfully.",
    });
  } catch (error) {
    logger.error(error, "Failed to delete exam paper");
    next(error);
  }
};

/**
 * Get all Exams for a class/term/session
 * @route GET /api/exams
 */
export const getExams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { schoolId, classId, termId, sessionId } = req.query;

    if (!schoolId) {
      return handleError(res, "schoolId is required query parameters.", 400);
    }

    const exams = await prisma.exam.findMany({
      where: {
        schoolId: schoolId as string,
        ...(classId && { classId: classId as string }),
        ...(termId && { termId: termId as string }),
        ...(sessionId && { sessionId: sessionId as string }),
      },
      include: {
        papers: {
          select: {
            id: true,
            subjectId: true,
            subject: {
              select: {
                name: true,
              },
            },
            maxMarks: true,
            paperDate: true,
            startTime: true,
            endTime: true,
            mode: true,
            questionBankId: true,
            totalQuestions: true,
          },
        },
        school: {
          select: {
            name: true,
          },
        },
        class: {
          select: {
            name: true,
          },
        },
        section: {
          select: {
            name: true,
          },
        },
        term: {
          select: {
            name: true,
          },
        },
        session: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startDate: "asc",
      },
    });

    res.status(200).json({
      success: true,
      message: "Exams fetched successfully.",
      data: exams,
    });
  } catch (error) {
    logger.error(error, "Failed to fetch exams");
    next(error);
  }
};

/**
 * Get a single Exam by ID
 * @route GET /api/exams/:id
 */
export const getExamById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { studentId } = req.query;
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        school: {
          select: {
            name: true,
          },
        },
        class: {
          select: {
            name: true,
          },
        },
        section: {
          select: {
            name: true,
          },
        },
        term: {
          select: {
            name: true,
          },
        },
        session: {
          select: {
            name: true,
          },
        },
        papers: {
          include: {
            subject: true,
            attempts: studentId
              ? { where: { studentId: studentId as string } }
              : true,
          },
        },
      },
    });

    if (!exam) {
      return handleError(res, "Exam not found.", 404);
    }

    res.status(200).json({
      success: true,
      message: "Exam fetched successfully.",
      data: exam,
    });
  } catch (error) {
    logger.error(error, "Failed to fetch exam");
    next(error);
  }
};

/**
 * Update an Exam
 * @route PUT /api/exams/:id
 */
export const updateExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const {
      title,
      startDate,
      endDate,
      status,
      schoolId,
      classId,
      termId,
      sessionId,
    } = req.body;

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      return handleError(res, "Exam not found.", 404);
    }

    if (exam.status === "Ongoing" || exam.status === "Completed") {
      return handleError(
        res,
        `Cannot update exam with status '${exam.status}'.`,
        400
      );
    }

    const updatedExam = await prisma.$transaction(async (tx) => {
      const examUpdate = await tx.exam.update({
        where: { id },
        data: {
          title,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          schoolId,
          classId,
          termId,
          sessionId,
          status,
        },
      });

      // Update the corresponding examTimetable entries
      await tx.examTimetable.updateMany({
        where: {
          examPaper: {
            examId: id,
          },
        },
        data: {
          classId: classId || undefined,
          termId: termId || undefined,
          sessionId: sessionId || undefined,
        },
      });
      return examUpdate;
    });

    logger.info({ examId: updatedExam.id }, "Exam updated successfully.");

    res.status(200).json({
      success: true,
      message: "Exam updated successfully.",
      data: updatedExam,
    });
  } catch (error) {
    logger.error(error, "Failed to update exam");
    next(error);
  }
};

/**
 * Delete an Exam
 * @route DELETE /api/exams/:id
 */
export const deleteExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: { papers: true },
    });

    if (!exam) {
      return handleError(res, "Exam not found.", 404);
    }

    if (exam.papers.length > 0) {
      return handleError(
        res,
        "Cannot delete exam because it has associated papers. Please delete the papers first.",
        400
      );
    }

    if (exam.status !== "Draft" && exam.status !== "Scheduled") {
      return handleError(res, `Cannot delete an ${exam.status} exam.`, 400);
    }

    await prisma.exam.delete({
      where: { id },
    });

    logger.info({ examId: id }, "Exam deleted successfully.");

    res.status(200).json({
      success: true,
      message: "Exam deleted successfully.",
    });
  } catch (error) {
    logger.error(error, "Failed to delete exam");
    next(error);
  }
};

/**
 * Get Exam for a student
 * @route GET /api/students/:studentId/exams
 */
export const getStudentExams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    const { sessionId, termId } = req.query;

    if (!studentId || !sessionId) {
      return handleError(
        res,
        "studentId, sessionId, and termId are required.",
        400
      );
    }

    const studentEnrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId: studentId as string,
        sessionId: sessionId as string,
      },
      select: {
        classId: true,
        sectionId: true,
      },
    });

    if (!studentEnrollment) {
      return handleError(
        res,
        "Student not enrolled in the specified session and term.",
        404
      );
    }

    const studentExams = await prisma.exam.findMany({
      where: {
        classId: studentEnrollment.classId,
        ...(studentEnrollment.sectionId && {
          sectionId: studentEnrollment.sectionId,
        }),
        sessionId: sessionId as string,
        termId: termId as string,
        status: { not: "Draft" }
      },
      include: {
        papers: {
          include: {
            subject: true,
            attempts: {
              where: {
                studentId: studentId as string,
              },
              include: {
                responses: true,
              },
            },
          },
        },
        school: {
          select: {
            name: true,
          },
        },
        class: {
          select: {
            name: true,
          },
        },
        section: {
          select: {
            name: true,
          },
        },
        term: {
          select: {
            name: true,
          },
        },
        session: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startDate: "asc",
      },
    });

    res.status(200).json({
      success: true,
      message: "Student exams fetched successfully.",
      data: studentExams,
    });
  } catch (error) {
    logger.error(error, "Failed to fetch student exams");
    next(error);
  }
};

/**
 * Get a single Exam Paper by ID
 * @route GET /api/exams/:examId/papers/:paperId
 */
export const getExamPaperById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { paperId } = req.params;

    if (!paperId) {
      return handleError(res, "Exam paper ID is required.", 400);
    }

    const examPaper = await prisma.examPaper.findUnique({
      where: { id: paperId },
      include: {
        subject: true,
        attempts: {
          where: {
            examPaperId: paperId,
          },
          include: {
            responses: true,
          },
        },
        exam: {
          select: {
            title: true,
            startDate: true,
            endDate: true,
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
            term: { select: { id: true, name: true } },
            session: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!examPaper) {
      return handleError(res, "Exam paper not found.", 404);
    }

    res.status(200).json({
      success: true,
      message: "Exam paper fetched successfully.",
      data: examPaper,
    });
  } catch (error) {
    logger.error(error, "Failed to fetch exam paper by ID");
    next(error);
  }
};

/**
 * Get all Exam Papers with optional term and section query
 * @route GET /api/exams/papers
 */
export const getAllExamPapers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { termId, schoolId, sectionId } = req.query;

    const where: any = {};
    if (termId) {
      where.exam = {
        termId: termId as string,
      };
    }
    if (schoolId) {
      where.exam = {
        ...where.exam,
        schoolId: schoolId as string,
      };
    }

    if (sectionId) {
      where.exam = {
        ...where.exam,
        sectionId: sectionId as string,
      };
    }

    const examPapers = await prisma.examPaper.findMany({
      where,
      include: {
        subject: true,
        exam: {
          select: {
            title: true,
            startDate: true,
            endDate: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
            term: { select: { name: true } },
            session: { select: { name: true } },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Exam papers fetched successfully.",
      data: examPapers,
    });
  } catch (error) {
    logger.error(error, "Failed to fetch all exam papers");
    next(error);
  }
};
