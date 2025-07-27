import { NextFunction, Request, Response } from "express";
import { classSchoolRequest } from "../types/requests";
import { handleError } from "../error/errorHandler"; // Local error response utility
import prisma from "../prisma";
import { PrismaClient, Classes as PrismaClasses } from "@prisma/client"; // Added PrismaClasses
import { paginateResults } from "../function/pagination";
import logger from "../utils/logger";

// Type for Prisma Transaction Client
type PrismaTransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Internal helper to create sections for a list of newly created classes.
 * @param tx - Prisma transactional client.
 * @param createdClassesArray - Array of class objects that were just created.
 * @param sectionString - Optional comma-separated string of section labels.
 * @param teacherId - Optional ID of a teacher to assign to new sections.
 */
const _createSectionsForClassesInTransaction = async (
    tx: PrismaTransactionClient,
    createdClassesArray: PrismaClasses[], // Use Prisma's generated type for Classes
    sectionString?: string,
    teacherId?: string
) => {
    if (sectionString) {
        const sectionLabels = sectionString.split(",").map((sec) => sec.trim().toUpperCase()).filter(s => s.length > 0);
        if (sectionLabels.length > 0) {
            await Promise.all(
                createdClassesArray.map((createdClass) =>
                    tx.class_Section.createMany({
                        data: sectionLabels.map((secLabel) => ({
                            label: secLabel,
                            classId: createdClass.id,
                            teacherId: teacherId || null,
                        })),
                    })
                )
            );
            logger.info({ classIds: createdClassesArray.map(c => c.id), sectionsCreated: sectionLabels }, "Sections created for new classes.");
        }
    }
};

/**
 * Internal helper to synchronize sections for an updated class.
 * Deletes sections not in `sectionString`, adds new ones. `teacherId` applies to new sections.
 * @param tx - Prisma transactional client.
 * @param classId - The ID of the class being updated.
 * @param sectionString - Optional comma-separated string of desired section labels.
 * @param teacherId - Optional ID of a teacher for new sections.
 */
const _synchronizeClassSectionsInTransaction = async (
    tx: PrismaTransactionClient,
    classId: string,
    sectionString?: string,
    teacherId?: string
) => {
    if (typeof sectionString === 'string') {
        const desiredSectionLabels = sectionString.split(",")
            .map(label => label.trim().toUpperCase())
            .filter(label => label.length > 0);

        const existingSections = await tx.class_Section.findMany({
            where: { classId: classId },
            select: { label: true, id: true }
        });
        const existingSectionLabels = existingSections.map(s => s.label.toUpperCase());

        const labelsToDelete = existingSectionLabels.filter(label => !desiredSectionLabels.includes(label));
        if (labelsToDelete.length > 0) {
            const sectionIdsToDelete = existingSections
                .filter(cs => labelsToDelete.includes(cs.label.toUpperCase()))
                .map(cs => cs.id);
            if (sectionIdsToDelete.length > 0) {
                await tx.class_Section.deleteMany({
                    where: { id: { in: sectionIdsToDelete } }
                });
                logger.info({ classId, deletedSectionIds: sectionIdsToDelete }, "Sections deleted for class update.");
            }
        }

        const labelsToAdd = desiredSectionLabels.filter(label => !existingSectionLabels.includes(label));
        if (labelsToAdd.length > 0) {
            await tx.class_Section.createMany({
                data: labelsToAdd.map(label => ({
                    classId: classId,
                    label: label, // Already uppercased
                    teacherId: teacherId || null,
                }))
            });
            logger.info({ classId, addedSections: labelsToAdd, teacherIdApplied: teacherId }, "Sections added for class update.");
        }
    } else if (sectionString === null && teacherId !== undefined) {
        logger.info({ classId, teacherId }, "TeacherId provided without section changes; existing sections' teachers not updated by this operation.");
    }
};


/**
 * Creates new classes and optionally associates them with sections.
 * @route POST /api/class
 */
export const createClass = async (
  req: Request<{}, {}, classSchoolRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { label, section, schoolId: schoolIdArray, teacherId } = req.body;

    const existingClass = await prisma.classes.findFirst({
      where: { label, schoolId: { in: schoolIdArray } },
    });
    if (existingClass) {
      logger.warn({ label, schoolIdArray }, "Attempt to create class that already exists in one of the schools.");
      return handleError(res, `Class with label "${label}" already exists in one of the provided school(s).`, 400);
    }

    const uniqueSchoolIds = [...new Set(schoolIdArray)];
    const schools = await prisma.school.findMany({
      where: { id: { in: uniqueSchoolIds }, isActive: true },
    });
    const invalidSchoolIds = uniqueSchoolIds.filter(id => !schools.some(s => s.id === id));
    if (invalidSchoolIds.length > 0) {
      logger.warn({ invalidSchoolIds, providedSchoolIds: schoolIdArray }, "Invalid or inactive school IDs provided during class creation.");
      return handleError(res, `Invalid or inactive school IDs provided: ${invalidSchoolIds.join(', ')}.`, 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdClasses = await Promise.all(
        uniqueSchoolIds.map((schId) =>
          tx.classes.create({ data: { label, schoolId: schId } })
        )
      );
      // Use the helper function to create sections
      await _createSectionsForClassesInTransaction(tx, createdClasses, section, teacherId);
      return createdClasses;
    });

    logger.info({ createdClassesCount: result.length, schoolIds: uniqueSchoolIds, label }, "Classes created successfully.");
    res.status(201).json({
      success: true, message: "Class(es) created successfully.", data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves all classes, optionally filtered and paginated.
 * @route GET /api/class
 */
export const getAllClasses = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { schoolId, search, page, limit } = req.query;
  try {
    const pageNumber = parseInt(page as string, 10) || 1;
    const limitNumber = parseInt(limit as string, 10) || 10;
    const whereClause: Prisma.ClassesWhereInput = {
        ...(schoolId && { schoolId: String(schoolId) }),
        ...(search && { label: { contains: search as string, mode: "insensitive" } }),
    };
    const classes = await prisma.classes.findMany({
      where: whereClause,
      include: { sections: true, schools: { select: { name: true } } },
      orderBy:{ createdAt: 'desc' },
      skip: (pageNumber - 1) * limitNumber, take: limitNumber,
    });
    const totalRecords = await prisma.classes.count({ where: whereClause });
    res.status(200).json({
      success: true, message: "All classes retrieved successfully.",
      data: paginateResults(classes, pageNumber, limitNumber, totalRecords),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a specific class by its ID.
 * @route GET /api/class/:id
 */
export const getClassById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const classId = req.params.id;
    const foundClass = await prisma.classes.findUnique({
      where: { id: classId },
      include: { sections: true, schools: { select: { name: true } } },
    });
    if (!foundClass) return handleError(res, "Class not found.", 404);
    res.status(200).json({ success: true, message: "Class retrieved successfully.", data: foundClass });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing class's label and/or its sections.
 * @route PUT /api/class/:id
 */
export const updateClass = async (
  req: Request<{ id: string }, {}, Partial<classSchoolRequest>>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: classId } = req.params;
    const { label, section, teacherId } = req.body;

    const existingClass = await prisma.classes.findUnique({ where: { id: classId } });
    if (!existingClass) return handleError(res, "Class not found.", 404);

    const updatedClassData = await prisma.$transaction(async (tx) => {
      const updatedClass = await tx.classes.update({
        where: { id: classId },
        data: { label: label !== undefined ? label : existingClass.label },
      });
      // Use the helper function to synchronize sections
      await _synchronizeClassSectionsInTransaction(tx, classId, section, teacherId);
      return updatedClass;
    });

    logger.info({ classId: updatedClassData.id, updatedLabel: updatedClassData.label }, "Class updated successfully.");
    res.status(200).json({
      success: true, message: "Class updated successfully.", data: updatedClassData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a class and its associated sections.
 * @route DELETE /api/class/:id
 */
export const deleteClass = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: classId } = req.params;
    const existingClass = await prisma.classes.findUnique({ where: { id: classId } });
    if (!existingClass) return handleError(res, "Class not found.", 404);

    await prisma.$transaction(async (tx) => {
      await tx.class_Section.deleteMany({ where: { classId } });
      await tx.classes.delete({ where: { id: classId } });
    });

    logger.info({ classId }, "Class and its sections deleted successfully.");
    res.status(200).json({
      success: true, message: "Class and associated sections deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
