import { NextFunction, Request, Response } from "express";
import { classSchoolRequest } from "../types/requests";
import { handleError } from "../error/errorHandler"; // Local error response utility
import prisma from "../prisma";
import { PrismaClient, Classes as PrismaClasses, Prisma } from "@prisma/client"; // Added PrismaClasses
import { paginateResults } from "../function/pagination";
import logger from "../utils/logger";

// Type for Prisma Transaction Client
type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Internal helper to create sections for a list of newly created classes.
 * @param tx - Prisma transactional client.
 * @param createdClassesArray - Array of class objects that were just created.
 * @param sectionString - Optional comma-separated string of section names.
 * @param teacherId - Optional ID of a teacher to assign to new sections.
 */
const _createSectionsForClassesInTransaction = async (
  tx: PrismaTransactionClient,
  createdClassesArray: PrismaClasses[],
  sectionString?: string
) => {
  if (sectionString) {
    const sectionnames = sectionString
      .split(",")
      .map((sec) => sec.trim().toUpperCase())
      .filter((s) => s.length > 0);
    if (sectionnames.length > 0) {
      await Promise.all(
        createdClassesArray.map((createdClass) =>
          tx.class_Section.createMany({
            data: sectionnames.map((secname) => ({
              name: secname,
              classId: createdClass.id,
            })),
          })
        )
      );
      logger.info(
        {
          classIds: createdClassesArray.map((c) => c.id),
          sectionsCreated: sectionnames,
        },
        "Sections created for new classes."
      );
    }
  }
};

/**
 * Internal helper to synchronize sections for an updated class.
 * Deletes sections not in `sectionString`, adds new ones. `teacherId` applies to new sections.
 * @param tx - Prisma transactional client.
 * @param classId - The ID of the class being updated.
 * @param sectionString - Optional comma-separated string of desired section names.
 * @param teacherId - Optional ID of a teacher for new sections.
 */
const _synchronizeClassSectionsInTransaction = async (
  tx: PrismaTransactionClient,
  classId: string,
  sectionString?: string,
  teacherId?: string
) => {
  if (typeof sectionString === "string") {
    const desiredSectionnames = sectionString
      .split(",")
      .map((name) => name.trim().toUpperCase())
      .filter((name) => name.length > 0);

    const existingSections = await tx.class_Section.findMany({
      where: { classId: classId },
      select: { name: true, id: true },
    });
    const existingSectionnames = existingSections.map((s) =>
      s.name.toUpperCase()
    );

    const namesToDelete = existingSectionnames.filter(
      (name) => !desiredSectionnames.includes(name)
    );
    if (namesToDelete.length > 0) {
      const sectionIdsToDelete = existingSections
        .filter((cs) => namesToDelete.includes(cs.name.toUpperCase()))
        .map((cs) => cs.id);
      if (sectionIdsToDelete.length > 0) {
        await tx.class_Section.deleteMany({
          where: { id: { in: sectionIdsToDelete } },
        });
        logger.info(
          { classId, deletedSectionIds: sectionIdsToDelete },
          "Sections deleted for class update."
        );
      }
    }

    const namesToAdd = desiredSectionnames.filter(
      (name) => !existingSectionnames.includes(name)
    );
    if (namesToAdd.length > 0) {
      await tx.class_Section.createMany({
        data: namesToAdd.map((name) => ({
          classId: classId,
          name: name,
          teacherId: teacherId || null,
        })),
      });
      logger.info(
        { classId, addedSections: namesToAdd, teacherIdApplied: teacherId },
        "Sections added for class update."
      );
    }
  } else if (sectionString === null && teacherId !== undefined) {
    logger.info(
      { classId, teacherId },
      "TeacherId provided without section changes; existing sections' teachers not updated by this operation."
    );
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
    const { name, section, schoolId: schoolIdArray } = req.body;

    const existingClass = await prisma.classes.findFirst({
      where: { name, schoolId: { in: schoolIdArray } },
    });
    if (existingClass) {
      logger.warn(
        { name, schoolIdArray },
        "Attempt to create class that already exists in one of the schools."
      );
      return handleError(
        res,
        `Class with name "${name}" already exists in one of the provided school(s).`,
        400
      );
    }

    const uniqueSchoolIds = [...new Set(schoolIdArray)];
    const schools = await prisma.school.findMany({
      where: { id: { in: uniqueSchoolIds }, isActive: true },
    });
    const invalidSchoolIds = uniqueSchoolIds.filter(
      (id) => !schools.some((s) => s.id === id)
    );
    if (invalidSchoolIds.length > 0) {
      logger.warn(
        { invalidSchoolIds, providedSchoolIds: schoolIdArray },
        "Invalid or inactive school IDs provided during class creation."
      );
      return handleError(
        res,
        `Invalid or inactive school IDs provided: ${invalidSchoolIds.join(", ")}.`,
        400
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdClasses = await Promise.all(
        uniqueSchoolIds.map((schId) =>
          tx.classes.create({ data: { name, schoolId: schId } })
        )
      );
      await _createSectionsForClassesInTransaction(tx, createdClasses, section);
      return createdClasses;
    });

    logger.info(
      { createdClassesCount: result.length, schoolIds: uniqueSchoolIds, name },
      "Classes created successfully."
    );
    res.status(201).json({
      success: true,
      message: "Class(es) created successfully.",
      data: result,
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
      ...(search && {
        name: { contains: search as string, mode: "insensitive" },
      }),
    };
    const classes = await prisma.classes.findMany({
      where: whereClause,
      include: { sections: true, schools: { select: { name: true } },  },
      orderBy: { createdAt: "desc" },
      skip: (pageNumber - 1) * limitNumber,
      take: limitNumber,
    });
    const totalRecords = await prisma.classes.count({ where: whereClause });
    res.status(200).json({
      success: true,
      message: "All classes retrieved successfully.",
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
      include: { sections: true, schools: { select: { name: true } }, },
    });
    if (!foundClass) return handleError(res, "Class not found.", 404);
    res
      .status(200)
      .json({
        success: true,
        message: "Class retrieved successfully.",
        data: foundClass,
      });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing class's name and/or its sections.
 * @route PUT /api/class/:id
 */
export const updateClass = async (
  req: Request<{ id: string }, {}, Partial<classSchoolRequest>>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: classId } = req.params;
    const { name, section, teacherId } = req.body;

    const existingClass = await prisma.classes.findUnique({
      where: { id: classId },
    });
    if (!existingClass) return handleError(res, "Class not found.", 404);

    const updatedClassData = await prisma.$transaction(async (tx) => {
      const updatedClass = await tx.classes.update({
        where: { id: classId },
        data: { name: name !== undefined ? name : existingClass.name },
      });
      await _synchronizeClassSectionsInTransaction(
        tx,
        classId,
        section,
        teacherId
      );
      return updatedClass;
    });

    logger.info(
      { classId: updatedClassData.id, updatedname: updatedClassData.name },
      "Class updated successfully."
    );
    res.status(200).json({
      success: true,
      message: "Class updated successfully.",
      data: updatedClassData,
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
    const existingClass = await prisma.classes.findUnique({
      where: { id: classId },
    });
    if (!existingClass) return handleError(res, "Class not found.", 404);

    await prisma.$transaction(async (tx) => {
      await tx.class_Section.deleteMany({ where: { classId } });
      await tx.classes.delete({ where: { id: classId } });
    });

    logger.info({ classId }, "Class and its sections deleted successfully.");
    res.status(200).json({
      success: true,
      message: "Class and associated sections deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
