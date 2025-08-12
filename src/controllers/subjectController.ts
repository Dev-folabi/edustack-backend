import { NextFunction, Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import prisma from "../prisma";
import { handleError } from "../error/errorHandler";
import logger from "../utils/logger";
import { CreateSubjectRequest } from "../types/requests";
import { checkIfAdminAction } from "../function/schoolFunctions";

type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Create a new subject with school and section associations
 * @route POST /api/subjects
 */
export const createSubject = async (
  req: Request<{}, {}, CreateSubjectRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      name,
      code,
      isActive = true,
      teacherId,
      schoolIds,
      sectionIds,
    } = req.body;

    const reqToken = (req as any).user;
    const isAdminAction = await checkIfAdminAction(reqToken, schoolIds);

    if (!isAdminAction) {
      logger.warn(
        { reqToken, schoolIds },
        "User is not authorized to create a subject in the specified schools."
      );
      return handleError(
        res,
        "You are not authorized to create a subject in the specified schools.",
        403
      );
    }

    const existingSubject = await prisma.subject.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existingSubject) {
      logger.warn(
        { name, code },
        "Attempt to create a subject with a duplicate name and code."
      );
      return handleError(
        res,
        `Subject with name "${name}" or code "${code}" already exists.`,
        400
      );
    }

    // 🔹 Validate school IDs
    const uniqueSchoolIds = [...new Set(schoolIds)];
    const schools = await prisma.school.findMany({
      where: { id: { in: uniqueSchoolIds }, isActive: true },
    });
    const invalidSchoolIds = uniqueSchoolIds.filter(
      (id) => !schools.some((s) => s.id === id)
    );
    if (invalidSchoolIds.length > 0) {
      logger.warn(
        { invalidSchoolIds },
        "Invalid or inactive school IDs provided."
      );
      return handleError(
        res,
        `Invalid or inactive school IDs: ${invalidSchoolIds.join(", ")}.`,
        400
      );
    }

    // 🔹 Validate section IDs
    const uniqueSectionIds = [...new Set(sectionIds)];
    const sections = await prisma.class_Section.findMany({
      where: { id: { in: uniqueSectionIds } },
    });
    const invalidSectionIds = uniqueSectionIds.filter(
      (id) => !sections.some((s) => s.id === id)
    );
    if (invalidSectionIds.length > 0) {
      logger.warn({ invalidSectionIds }, "Invalid section IDs provided.");
      return handleError(
        res,
        `Invalid section IDs: ${invalidSectionIds.join(", ")}.`,
        400
      );
    }

    // 🔹 Create subject in a transaction
    const createdSubject = await prisma.$transaction(
      async (tx: PrismaTransactionClient) => {
        const subject = await tx.subject.create({
          data: {
            name,
            code,
            isActive,
            teacherId,
            schools: {
              create: uniqueSchoolIds.map((schoolId) => ({ schoolId })),
            },
            sections: {
              create: uniqueSectionIds.map((sectionId) => ({ sectionId })),
            },
          },
        });

        return subject;
      }
    );

    logger.info(
      { subjectId: createdSubject.id },
      "Subject created successfully."
    );
    res.status(201).json({
      success: true,
      message: "Subject created successfully.",
      data: createdSubject,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all subjects with optional filters
 * @route GET /api/subjects
 */
export const getSubjects = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { schoolId, sectionId, isActive } = req.query;

    const where: Prisma.SubjectWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }
    if (schoolId) {
      where.schools = { some: { schoolId: String(schoolId) } };
    }
    if (sectionId) {
      where.sections = { some: { sectionId: String(sectionId) } };
    }

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        schools: { include: { school: true } },
        sections: { include: { section: true } },
        teacher: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects,
    });
  } catch (error) {
    next(error);
  }
};
