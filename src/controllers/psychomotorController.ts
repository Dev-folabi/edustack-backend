import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { handleError } from "../error/errorHandler";
import logger from "../utils/logger";
import { getIdFromToken } from "../function/token";

/**
 * Save or update psychomotor assessments for multiple students.
 * Expects an array of assessment data in the request body.
 * @route POST /api/psychomotor/assessments
 */
export const savePsychomotorAssessments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { assessments } = req.body; // Expecting: [{ studentId, skillId, termId, sessionId, rating }]
        const staffUserId = getIdFromToken(req);

        if (!staffUserId) {
            return handleError(res, "Unauthorized: User ID not found in token.", 401);
        }

        const staff = await prisma.staff.findUnique({ where: { userId: staffUserId }});
        if (!staff) {
             return handleError(res, "Forbidden: User is not a registered staff member.", 403);
        }
        const staffId = staff.id;

        if (!Array.isArray(assessments) || assessments.length === 0) {
            return handleError(res, "Request body must be a non-empty array of assessments.", 400);
        }

        const upsertOperations = assessments.map(asm => {
            const { studentId, skillId, termId, sessionId, rating } = asm;
            return prisma.studentPsychomotorAssessment.upsert({
                where: {
                    studentId_skillId_termId_sessionId: {
                        studentId,
                        skillId,
                        termId,
                        sessionId
                    }
                },
                update: {
                    rating,
                    assessedById: staffId
                },
                create: {
                    studentId,
                    skillId,
                    termId,
                    sessionId,
                    rating,
                    assessedById: staffId
                }
            });
        });

        await prisma.$transaction(upsertOperations);

        logger.info({ count: assessments.length, assessedBy: staffId }, "Psychomotor assessments saved successfully.");

        res.status(201).json({
            success: true,
            message: `Successfully saved ${assessments.length} assessment(s).`,
        });

    } catch (error) {
        logger.error(error, "Failed to save psychomotor assessments");
        next(error);
    }
};
