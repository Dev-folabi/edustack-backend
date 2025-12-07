import { NextFunction, Request, Response } from "express";
import prisma from "../../prisma";
import logger from "../../utils/logger";
import { getSchoolIdFromRequest } from "../../function/schoolFunctions";

/**
 * Get Global Exam Settings for the user's school
 * @route GET /api/exam/settings/global
 */
export const getGlobalExamSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = await getSchoolIdFromRequest(req, res);
    if (schoolId === null) return;

    const settings = await prisma.globalExamSettings.findUnique({
      where: { schoolId },
    });

    if (!settings) {
      const defaultSettings = await prisma.globalExamSettings.create({
        data: { schoolId },
      });
      res.status(200).json({
        success: true,
        message: "Global exam settings fetched successfully.",
        data: defaultSettings,
      });
      return;
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

/**
 * Get all Grade Criteria for the user's school
 * @route GET /api/exam/settings/grades
 */
export const getGradeCriteria = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = await getSchoolIdFromRequest(req, res);
    if (schoolId === null) return;

    const gradeCriteria = await prisma.gradeCriteria.findMany({
      where: { schoolId },
      orderBy: { minScore: "desc" },
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
export const createGradeCriteria = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = await getSchoolIdFromRequest(req, res);
    if (schoolId === null) return;

    const { name, minScore, maxScore, remark } = req.body;

    const existingGrades = await prisma.gradeCriteria.findMany({
      where: {
        schoolId,
        OR: [
          {
            AND: [
              { minScore: { lte: maxScore } },
              { maxScore: { gte: minScore } },
            ],
          },
        ],
      },
    });

    if (existingGrades.length > 0) {
      res.status(400).json({
        success: false,
        message:
          "The score range overlaps with existing grade criteria. Please choose a different range.",
        data: existingGrades,
      });
      return;
    }

    // Validate that minScore is less than maxScore
    if (minScore >= maxScore) {
      res.status(400).json({
        success: false,
        message: "Minimum score must be less than maximum score.",
      });
      return;
    }

    // Validate score ranges are between 0 and 100
    if (minScore < 0 || maxScore > 100) {
      res.status(400).json({
        success: false,
        message: "Score ranges must be between 0 and 100.",
      });
      return;
    }

    const newGrade = await prisma.gradeCriteria.create({
      data: {
        schoolId,
        name,
        minScore,
        maxScore,
        remark,
      },
    });

    logger.info(
      { schoolId, gradeId: newGrade.id },
      "Grade criterion created successfully."
    );

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
export const updateGradeCriteria = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const schoolId = await getSchoolIdFromRequest(req, res);
    if (schoolId === null) return;
    const { name, minScore, maxScore, remark } = req.body;

    // Check for overlapping score ranges with other grade criteria
    const existingGrades = await prisma.gradeCriteria.findMany({
      where: {
        schoolId,
        id: { not: id },
        OR: [
          {
            AND: [
              { minScore: { lte: maxScore } },
              { maxScore: { gte: minScore } },
            ],
          },
        ],
      },
    });

    if (existingGrades.length > 0) {
      res.status(400).json({
        success: false,
        message:
          "The score range overlaps with existing grade criteria. Please choose a different range.",
        data: existingGrades,
      });
      return;
    }

    // Validate that minScore is less than maxScore
    if (minScore >= maxScore) {
      res.status(400).json({
        success: false,
        message: "Minimum score must be less than maximum score.",
      });
      return;
    }

    // Validate score ranges are between 0 and 100
    if (minScore < 0 || maxScore > 100) {
      res.status(400).json({
        success: false,
        message: "Score ranges must be between 0 and 100.",
      });
      return;
    }

    const updatedGrade = await prisma.gradeCriteria.update({
      where: { id },
      data: { name, minScore, maxScore, remark },
    });

    logger.info(
      { gradeId: updatedGrade.id },
      "Grade criterion updated successfully."
    );

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
export const deleteGradeCriteria = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    await prisma.gradeCriteria.delete({
      where: { id },
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

/**
 * Get all Psychomotor Skills for the user's school
 * @route GET /api/exam/settings/psychomotor
 */
export const getPsychomotorSkills = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = await getSchoolIdFromRequest(req, res);
    if (schoolId === null) return;

    const skills = await prisma.psychomotorSkill.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
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
export const createPsychomotorSkill = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = await getSchoolIdFromRequest(req, res);
    if (schoolId === null) return;

    const { name, description } = req.body;

    const newSkill = await prisma.psychomotorSkill.create({
      data: {
        schoolId,
        name,
        description,
      },
    });

    logger.info(
      { schoolId, skillId: newSkill.id },
      "Psychomotor skill created successfully."
    );

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
export const updatePsychomotorSkill = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const updatedSkill = await prisma.psychomotorSkill.update({
      where: { id },
      data: { name, description },
    });

    logger.info(
      { skillId: updatedSkill.id },
      "Psychomotor skill updated successfully."
    );

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
export const deletePsychomotorSkill = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    // Check if the skill is in use before deleting
    const assessments = await prisma.studentPsychomotorAssessment.findFirst({
      where: { skillId: id },
    });

    if (assessments) {
      res.status(400).json({
        success: false,
        message:
          "Cannot delete this skill as it is already in use in student assessments.",
      });
      return;
    }

    await prisma.psychomotorSkill.delete({
      where: { id },
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
export const upsertGlobalExamSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = await getSchoolIdFromRequest(req, res);
    if (schoolId === null) return;

    const {
      enablePsychomotor,
      showSchoolRemarks,
      showTeacherRemarks,
      passMark,
      enablePosition,
    } = req.body;

    const dataToUpsert = {
      enablePsychomotor,
      showSchoolRemarks,
      showTeacherRemarks,
      passMark,
      enablePosition,
    };

    const settings = await prisma.globalExamSettings.upsert({
      where: { schoolId },
      update: dataToUpsert,
      create: {
        schoolId,
        ...dataToUpsert,
      },
    });

    logger.info(
      { schoolId, settingsId: settings.id },
      "Global exam settings upserted successfully."
    );

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
