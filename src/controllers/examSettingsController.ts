import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { handleError } from "../error/errorHandler";
import logger from "../utils/logger";
import { getIdFromToken } from "../function/token";

// Helper function to get schoolId from the logged-in user's token.
// This assumes a user is associated with one primary school for this context.
const getSchoolIdFromRequest = async (req: Request, res: Response) => {
    const userId = getIdFromToken(req);
    if (!userId) {
        handleError(res, "Unauthorized: User ID not found in token.", 401);
        return null;
    }
    const userSchool = await prisma.userSchool.findFirst({
        where: { userId: userId },
        select: { schoolId: true }
    });
    if (!userSchool) {
        handleError(res, "Not Found: User is not associated with any school.", 404);
        return null;
    }
    return userSchool.schoolId;
}

/**
 * Get Global Exam Settings for the user's school
 * @route GET /api/exam/settings/global
 */
export const getGlobalExamSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schoolId = await getSchoolIdFromRequest(req, res);
        if (schoolId === null) return;

        const settings = await prisma.globalExamSettings.findUnique({
            where: { schoolId },
        });

        if (!settings) {
             // If settings don't exist, create a default one
            const defaultSettings = await prisma.globalExamSettings.create({
                data: { schoolId }
            });
             return res.status(200).json({
                success: true,
                message: "Global exam settings not found, returned default values.",
                data: defaultSettings,
            });
        }

        res.status(200).json({
            success: true,
            message: "Global exam settings fetched successfully.",
            data: settings,
        });
    } catch (error) {
        logger.error(error, "Failed to get global exam settings");
        next(error);
    }
};

// ----------------- Grade Criteria -----------------

/**
 * Get all Grade Criteria for the user's school
 * @route GET /api/exam/settings/grades
 */
export const getGradeCriteria = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schoolId = await getSchoolIdFromRequest(req, res);
        if (schoolId === null) return;

        const gradeCriteria = await prisma.gradeCriteria.findMany({
            where: { schoolId },
            orderBy: { minScore: 'desc' }
        });

        res.status(200).json({
            success: true,
            message: "Grade criteria fetched successfully.",
            data: gradeCriteria,
        });
    } catch (error) {
        logger.error(error, "Failed to get grade criteria");
        next(error);
    }
};

/**
 * Create a new Grade Criterion for the user's school
 * @route POST /api/exam/settings/grades
 */
export const createGradeCriteria = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schoolId = await getSchoolIdFromRequest(req, res);
        if (schoolId === null) return;

        const { name, minScore, maxScore, remark } = req.body;

        // TODO: Add validation to prevent overlapping score ranges

        const newGrade = await prisma.gradeCriteria.create({
            data: {
                schoolId,
                name,
                minScore,
                maxScore,
                remark,
            }
        });

        logger.info({ schoolId, gradeId: newGrade.id }, "Grade criterion created successfully.");

        res.status(201).json({
            success: true,
            message: "Grade criterion created successfully.",
            data: newGrade,
        });
    } catch (error) {
        logger.error(error, "Failed to create grade criterion");
        next(error);
    }
};

/**
 * Update a Grade Criterion
 * @route PUT /api/exam/settings/grades/:id
 */
export const updateGradeCriteria = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, minScore, maxScore, remark } = req.body;

        const updatedGrade = await prisma.gradeCriteria.update({
            where: { id },
            data: { name, minScore, maxScore, remark }
        });

        logger.info({ gradeId: updatedGrade.id }, "Grade criterion updated successfully.");

        res.status(200).json({
            success: true,
            message: "Grade criterion updated successfully.",
            data: updatedGrade,
        });
    } catch (error) {
        logger.error(error, "Failed to update grade criterion");
        next(error);
    }
};

/**
 * Delete a Grade Criterion
 * @route DELETE /api/exam/settings/grades/:id
 */
export const deleteGradeCriteria = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        await prisma.gradeCriteria.delete({
            where: { id }
        });

        logger.info({ gradeId: id }, "Grade criterion deleted successfully.");

        res.status(200).json({
            success: true,
            message: "Grade criterion deleted successfully.",
        });
    } catch (error) {
        logger.error(error, "Failed to delete grade criterion");
        next(error);
    }
};


// ----------------- Psychomotor Skills -----------------

/**
 * Get all Psychomotor Skills for the user's school
 * @route GET /api/exam/settings/psychomotor
 */
export const getPsychomotorSkills = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schoolId = await getSchoolIdFromRequest(req, res);
        if (schoolId === null) return;

        const skills = await prisma.psychomotorSkill.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' }
        });

        res.status(200).json({
            success: true,
            message: "Psychomotor skills fetched successfully.",
            data: skills,
        });
    } catch (error) {
        logger.error(error, "Failed to get psychomotor skills");
        next(error);
    }
};

/**
 * Create a new Psychomotor Skill for the user's school
 * @route POST /api/exam/settings/psychomotor
 */
export const createPsychomotorSkill = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schoolId = await getSchoolIdFromRequest(req, res);
        if (schoolId === null) return;

        const { name, description } = req.body;

        const newSkill = await prisma.psychomotorSkill.create({
            data: {
                schoolId,
                name,
                description
            }
        });

        logger.info({ schoolId, skillId: newSkill.id }, "Psychomotor skill created successfully.");

        res.status(201).json({
            success: true,
            message: "Psychomotor skill created successfully.",
            data: newSkill,
        });
    } catch (error) {
        logger.error(error, "Failed to create psychomotor skill");
        next(error);
    }
};

/**
 * Update a Psychomotor Skill
 * @route PUT /api/exam/settings/psychomotor/:id
 */
export const updatePsychomotorSkill = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const updatedSkill = await prisma.psychomotorSkill.update({
            where: { id },
            data: { name, description }
        });

        logger.info({ skillId: updatedSkill.id }, "Psychomotor skill updated successfully.");

        res.status(200).json({
            success: true,
            message: "Psychomotor skill updated successfully.",
            data: updatedSkill,
        });
    } catch (error) {
        logger.error(error, "Failed to update psychomotor skill");
        next(error);
    }
};

/**
 * Delete a Psychomotor Skill
 * @route DELETE /api/exam/settings/psychomotor/:id
 */
export const deletePsychomotorSkill = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        // Check if the skill is in use before deleting
        const assessments = await prisma.studentPsychomotorAssessment.findFirst({
            where: { skillId: id }
        });

        if (assessments) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete this skill as it is already in use in student assessments.",
            });
        }

        await prisma.psychomotorSkill.delete({
            where: { id }
        });

        logger.info({ skillId: id }, "Psychomotor skill deleted successfully.");

        res.status(200).json({
            success: true,
            message: "Psychomotor skill deleted successfully.",
        });
    } catch (error) {
        logger.error(error, "Failed to delete psychomotor skill");
        next(error);
    }
};

/**
 * Create or Update Global Exam Settings for the user's school
 * @route POST /api/exam/settings/global
 */
export const upsertGlobalExamSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schoolId = await getSchoolIdFromRequest(req, res);
        if (schoolId === null) return;

        const { enablePsychomotor, showSchoolRemarks, showTeacherRemarks, passMark } = req.body;

        const dataToUpsert = {
            enablePsychomotor,
            showSchoolRemarks,
            showTeacherRemarks,
            passMark,
        };

        const settings = await prisma.globalExamSettings.upsert({
            where: { schoolId },
            update: dataToUpsert,
            create: {
                schoolId,
                ...dataToUpsert
            },
        });

        logger.info({ schoolId, settingsId: settings.id }, "Global exam settings upserted successfully.");

        res.status(201).json({
            success: true,
            message: "Global exam settings saved successfully.",
            data: settings,
        });
    } catch (error) {
        logger.error(error, "Failed to upsert global exam settings");
        next(error);
    }
};
