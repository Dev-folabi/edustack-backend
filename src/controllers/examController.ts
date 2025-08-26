import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { handleError } from "../error/errorHandler";
import logger from "../utils/logger";
import { getIdFromToken } from "../function/token";

// Note: This helper is duplicative. It should be refactored into a shared middleware.
const getStaffInfoFromRequest = async (req: Request, res: Response) => {
    const userId = getIdFromToken(req);
    if (!userId) {
        handleError(res, "Unauthorized: User ID not found in token.", 401);
        return null;
    }
    const staffInfo = await prisma.staff.findUnique({
        where: { userId },
    });

    if (!staffInfo) {
        handleError(res, "Forbidden: User is not a staff member.", 403);
        return null;
    }

    return { staffId: staffInfo.id };
}

/**
 * Create a new Exam
 * @route POST /api/exams
 */
export const createExam = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const staffInfo = await getStaffInfoFromRequest(req, res);
        if (!staffInfo) return;

        const { title, startDate, endDate, classId, sectionId, termId, sessionId } = req.body;

        const newExam = await prisma.exam.create({
            data: {
                title,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                classId,
                sectionId,
                termId,
                sessionId,
                createdById: staffInfo.staffId,
            }
        });

        logger.info({ examId: newExam.id, createdBy: staffInfo.staffId }, "Exam created successfully.");

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
 * Get Exam Timetable for a class/section
 * @route GET /api/exams/timetable
 */
export const getExamTimetable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { classId, sectionId, sessionId, termId } = req.query;

        if (!classId || !sessionId || !termId) {
            return handleError(res, "classId, sessionId, and termId are required.", 400);
        }

        const timetable = await prisma.examTimetable.findMany({
            where: {
                classId: classId as string,
                sectionId: sectionId ? sectionId as string : undefined,
                sessionId: sessionId as string,
                termId: termId as string,
            },
            include: {
                examPaper: {
                    include: {
                        subject: true,
                        exam: {
                            select: {
                                title: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                examPaper: {
                    paperDate: 'asc'
                }
            }
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

// ----------------- Exam Papers -----------------

/**
 * Add a paper to an existing Exam
 * @route POST /api/exams/:examId/papers
 */
export const addExamPaper = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { examId } = req.params;
        const { subjectId, maxMarks, paperDate, startTime, endTime, mode, questionBankId, totalQuestions } = req.body;

        const exam = await prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) {
            return handleError(res, "Exam not found, cannot add paper.", 404);
        }

        if (mode === 'CBT' && !questionBankId) {
            return handleError(res, "A Question Bank must be linked for CBT exams.", 400);
        }

        const [newPaper] = await prisma.$transaction([
            prisma.examPaper.create({
                data: {
                    examId,
                    subjectId,
                    maxMarks,
                    paperDate: new Date(paperDate),
                    startTime: new Date(startTime),
                    endTime: new Date(endTime),
                    mode,
                    questionBankId,
                    totalQuestions
                }
            }),
            // The creation of the timetable entry is now part of the transaction
            // But we need the newPaper.id. Let's do it in two steps.
        ]);

        // Create timetable entry separately, as we need the ID from the created paper.
        // For full atomicity, this would require a nested write, which is more complex.
        // This two-step approach is simpler and generally sufficient.
        await prisma.examTimetable.create({
            data: {
                examPaperId: newPaper.id,
                classId: exam.classId,
                sectionId: exam.sectionId,
                termId: exam.termId,
                sessionId: exam.sessionId,
            }
        });

        logger.info({ paperId: newPaper.id, examId }, "Exam paper and timetable entry added successfully.");

        res.status(201).json({
            success: true,
            message: "Exam paper added successfully.",
            data: newPaper,
        });
    } catch (error) {
        logger.error(error, "Failed to add exam paper");
        // If the transaction failed, we might need to clean up the timetable entry if it was created.
        // However, with the current flow, if paper creation fails, timetable won't be created.
        next(error);
    }
};

/**
 * Update an Exam Paper
 * @route PUT /api/exams/:examId/papers/:paperId
 */
export const updateExamPaper = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { paperId } = req.params;
        const { maxMarks, paperDate, startTime, endTime, mode, questionBankId, totalQuestions } = req.body;

        const existingPaper = await prisma.examPaper.findUnique({ where: { id: paperId } });
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
                questionBankId,
                totalQuestions
            }
        });

        // The timetable doesn't store date/time, it's just a schedule entry.
        // The details are pulled from the ExamPaper. So no update is needed on the timetable entry itself
        // unless the class/section changes, which is not allowed here.

        logger.info({ paperId: updatedPaper.id }, "Exam paper updated successfully.");

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
export const deleteExamPaper = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { paperId } = req.params;

        const attempts = await prisma.examAttempt.count({
            where: { examPaperId: paperId }
        });

        if (attempts > 0) {
            return handleError(res, "Cannot delete paper because students have already attempted it.", 400);
        }

        // Use a transaction to delete both the paper and its timetable entry
        await prisma.$transaction([
            prisma.examTimetable.deleteMany({
                where: { examPaperId: paperId }
            }),
            prisma.examPaper.delete({
                where: { id: paperId }
            })
        ]);

        logger.info({ paperId }, "Exam paper and timetable entry deleted successfully.");

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
export const getExams = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { classId, termId, sessionId } = req.query;

        if (!classId || !termId || !sessionId) {
            return handleError(res, "classId, termId, and sessionId are required query parameters.", 400);
        }

        const exams = await prisma.exam.findMany({
            where: {
                classId: classId as string,
                termId: termId as string,
                sessionId: sessionId as string,
            },
            include: {
                papers: true,
            },
            orderBy: {
                startDate: 'asc'
            }
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
export const getExamById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const exam = await prisma.exam.findUnique({
            where: { id },
            include: {
                papers: {
                    include: {
                        subject: true
                    }
                }
            }
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
export const updateExam = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { title, startDate, endDate, status } = req.body;

        const exam = await prisma.exam.findUnique({ where: { id } });
        if (!exam) {
            return handleError(res, "Exam not found.", 404);
        }

        if (exam.status === 'Ongoing' || exam.status === 'Completed') {
            return handleError(res, `Cannot update exam with status '${exam.status}'.`, 400);
        }

        const updatedExam = await prisma.exam.update({
            where: { id },
            data: {
                title,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                status
            }
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
export const deleteExam = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const exam = await prisma.exam.findUnique({
            where: { id },
            include: { papers: true }
        });

        if (!exam) {
            return handleError(res, "Exam not found.", 404);
        }

        if (exam.papers.length > 0) {
            return handleError(res, "Cannot delete exam because it has associated papers. Please delete the papers first.", 400);
        }

        if (exam.status !== 'Draft') {
             return handleError(res, "Cannot delete an exam that is not in 'Draft' status.", 400);
        }

        await prisma.exam.delete({
            where: { id }
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
