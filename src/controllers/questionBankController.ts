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
 * Create a new Question Bank
 * @route POST /api/question-banks
 */
export const createQuestionBank = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const staffInfo = await getStaffInfoFromRequest(req, res);
        if (!staffInfo) return;

        const { name, description, subjectId } = req.body;

        const newBank = await prisma.questionBank.create({
            data: {
                name,
                description,
                subjectId,
                createdById: staffInfo.staffId,
            }
        });

        logger.info({ bankId: newBank.id, createdBy: staffInfo.staffId }, "Question Bank created successfully.");

        res.status(201).json({
            success: true,
            message: "Question Bank created successfully.",
            data: newBank,
        });
    } catch (error) {
        logger.error(error, "Failed to create Question Bank");
        next(error);
    }
};

// ----------------- Questions -----------------

/**
 * Add a Question to a Question Bank
 * @route POST /api/question-banks/:bankId/questions
 */
export const addQuestionToBank = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { bankId } = req.params;
        const { type, questionText, options, correctAnswer, marks, difficulty } = req.body;

        const staffInfo = await getStaffInfoFromRequest(req, res);
        if (!staffInfo) return;

        const newQuestion = await prisma.question.create({
            data: {
                bankId,
                type,
                questionText,
                options, // Prisma handles JSON
                correctAnswer, // Prisma handles JSON
                marks,
                difficulty,
                createdById: staffInfo.staffId,
            }
        });

        logger.info({ questionId: newQuestion.id, bankId }, "Question added to bank successfully.");

        res.status(201).json({
            success: true,
            message: "Question added successfully.",
            data: newQuestion,
        });
    } catch (error) {
        logger.error(error, "Failed to add question");
        next(error);
    }
};

/**
 * Update a Question
 * @route PUT /api/question-banks/:bankId/questions/:questionId
 */
export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { questionId } = req.params;
        const { type, questionText, options, correctAnswer, marks, difficulty } = req.body;

        const updatedQuestion = await prisma.question.update({
            where: { id: questionId },
            data: {
                type,
                questionText,
                options,
                correctAnswer,
                marks,
                difficulty,
            }
        });

        logger.info({ questionId: updatedQuestion.id }, "Question updated successfully.");

        res.status(200).json({
            success: true,
            message: "Question updated successfully.",
            data: updatedQuestion,
        });
    } catch (error) {
        logger.error(error, "Failed to update question");
        next(error);
    }
};

/**
 * Delete a Question
 * @route DELETE /api/question-banks/:bankId/questions/:questionId
 */
export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { questionId } = req.params;

        // A check could be added here to see if the question has been used in any exam responses.
        // For now, we will allow deletion.

        await prisma.question.delete({
            where: { id: questionId }
        });

        logger.info({ questionId }, "Question deleted successfully.");

        res.status(200).json({
            success: true,
            message: "Question deleted successfully.",
        });
    } catch (error) {
        logger.error(error, "Failed to delete question");
        next(error);
    }
};

/**
 * Get all Question Banks (e.g., for a subject)
 * @route GET /api/question-banks
 */
export const getQuestionBanks = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { subjectId } = req.query;

        const banks = await prisma.questionBank.findMany({
            where: {
                subjectId: subjectId ? subjectId as string : undefined,
            },
            include: {
                _count: {
                    select: { questions: true }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        res.status(200).json({
            success: true,
            message: "Question Banks fetched successfully.",
            data: banks,
        });
    } catch (error) {
        logger.error(error, "Failed to fetch Question Banks");
        next(error);
    }
};

/**
 * Get a single Question Bank by ID with its questions
 * @route GET /api/question-banks/:id
 */
export const getQuestionBankById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const bank = await prisma.questionBank.findUnique({
            where: { id },
            include: {
                questions: {
                     orderBy: {
                        createdAt: 'asc'
                    }
                },
                subject: true
            }
        });

        if (!bank) {
            return handleError(res, "Question Bank not found.", 404);
        }

        res.status(200).json({
            success: true,
            message: "Question Bank fetched successfully.",
            data: bank,
        });
    } catch (error) {
        logger.error(error, "Failed to fetch Question Bank");
        next(error);
    }
};

/**
 * Update a Question Bank
 * @route PUT /api/question-banks/:id
 */
export const updateQuestionBank = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const updatedBank = await prisma.questionBank.update({
            where: { id },
            data: {
                name,
                description,
            }
        });

        logger.info({ bankId: updatedBank.id }, "Question Bank updated successfully.");

        res.status(200).json({
            success: true,
            message: "Question Bank updated successfully.",
            data: updatedBank,
        });
    } catch (error) {
        logger.error(error, "Failed to update Question Bank");
        next(error);
    }
};

/**
 * Delete a Question Bank
 * @route DELETE /api/question-banks/:id
 */
export const deleteQuestionBank = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const linkedPapers = await prisma.examPaper.count({
            where: { questionBankId: id }
        });

        if (linkedPapers > 0) {
            return handleError(res, `Cannot delete bank because it is linked to ${linkedPapers} exam paper(s).`, 400);
        }

        // Prisma's cascading delete will handle the questions if the relation is set up correctly.
        // If not, manual deletion is required. Let's assume cascading delete is not on by default.
        await prisma.question.deleteMany({ where: { bankId: id } });
        await prisma.questionBank.delete({ where: { id } });

        logger.info({ bankId: id }, "Question Bank deleted successfully.");

        res.status(200).json({
            success: true,
            message: "Question Bank and all its questions have been deleted successfully.",
        });
    } catch (error) {
        logger.error(error, "Failed to delete Question Bank");
        next(error);
    }
};
