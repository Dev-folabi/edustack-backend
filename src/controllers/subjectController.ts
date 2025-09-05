import { NextFunction, Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import prisma from "../prisma";
import { handleError } from "../error/errorHandler";
import logger from "../utils/logger";
import { CreateSubjectRequest } from "../types/requests";
import { checkIfAdminAction } from "../function/schoolFunctions";
import { paginateResults } from "../function/pagination";

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
      return handleError(res, `Invalid or inactive school included}.`, 400);
    }

    const uniqueSectionIds = [...new Set(sectionIds)];
    const sections = await prisma.class_Section.findMany({
      where: { id: { in: uniqueSectionIds } },
    });
    const invalidSectionIds = uniqueSectionIds.filter(
      (id) => !sections.some((s) => s.id === id)
    );
    if (invalidSectionIds.length > 0) {
      logger.warn({ invalidSectionIds }, "Invalid section IDs provided.");
      return handleError(res, `Invalid section included}.`, 400);
    }

    const createdSubject = await prisma.$transaction(
      async (tx: PrismaTransactionClient) => {
        const subject = await tx.subject.create({
          data: {
            name,
            code,
            isActive,
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
    const { schoolId, sectionId, isActive, teacherId } = req.query;
    const user = (req as any).user;
    if (!user) {
      logger.warn("User is not authorized to perform this action.");
      return handleError(
        res,
        "You are not authorized to perform this action.",
        403
      );
    }

    const page = Math.max(parseInt(req.query?.page as string, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query?.limit as string, 10) || 10, 1);

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
    if (teacherId) {
      where.teacherId = String(teacherId);
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
      message: "Subjects retrieved successfully.",
      data: paginateResults(subjects, page, limit, subjects.length),
    });
  } catch (error) {
    next(error);
  }
};

export const getSubjectById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;
    if (!user) {
      logger.warn("User is not authorized to perform this action.");
      return handleError(
        res,
        "You are not authorized to perform this action.",
        403
      );
    }

    const { id } = req.params;

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        schools: { include: { school: true } },
        sections: { include: { section: true } },
        teacher: true,
      },
    });

    if (!subject) {
      return handleError(res, "Subject not found", 404)
    }

    res.json({
      success: true,
      message: "Subject retrieved successfully.",
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const reqToken = (req as any).user;
    const { id, name, code, isActive } = req.body;

    const uniqueIds = [...new Set(id as string[])];

    const subjects = await prisma.subject.findMany({
      where: { id: { in: uniqueIds } },
      include: {
        schools: true,
        sections: true,
      },
    });

    const invalidIds = uniqueIds.filter(
      (uid) => !subjects.some((s) => s.id === uid)
    );
    if (invalidIds.length > 0) {
      logger.warn({ invalidIds }, "Invalid subject IDs provided.");
      return handleError(res, "Invalid subject included.", 400);
    }

    const schoolIds = [
      ...new Set(subjects.flatMap((s) => s.schools.map((sc) => sc.schoolId))),
    ];

    const isAdminAction = await checkIfAdminAction(reqToken, schoolIds);
    if (!isAdminAction) {
      logger.warn(
        { reqToken },
        "User is not authorized to update a subject in the specified schools."
      );
      return handleError(
        res,
        "You are not authorized to update a subject in the specified schools.",
        403
      );
    }

    const updatedSubjects: any = [];
    for (const subjectId of uniqueIds) {
      const updated = await prisma.subject.update({
        where: { id: subjectId },
        data: {
          ...(name && { name }),
          ...(code && { code }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      updatedSubjects.push(updated);
    }

    res.json({
      success: true,
      message: "Subjects updated successfully.",
      data: updatedSubjects,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSubject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const reqToken = (req as any).user;

    const { id } = req.params;

    const existingSubject = await prisma.subject.findUnique({
      where: { id },
      include: {
        schools: true,
      },
    });
    if (!existingSubject) {
      return handleError(res, "Invalid, subject not found", 400);
    }

    const schoolId = [
      ...new Set(existingSubject.schools.flatMap((s) => s.schoolId)),
    ];
    const isAdminAction = checkIfAdminAction(reqToken, schoolId);

    if (!isAdminAction) {
      logger.warn(
        { reqToken },
        "User is not authorized to update a subject in the specified schools."
      );
      return handleError(
        res,
        "You are not authorized to update a subject in the specified schools.",
        403
      );
    }

    const subject = await prisma.subject.delete({
      where: { id }
    });

    res.json({ success: true, message: "Subject deleted", data: subject });

  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to deactivate subject", error });
  }
};

export const assignTeacherToSubject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const reqToken = (req as any).user;

    const isAdminAction = await checkIfAdminAction(reqToken);
    if (!isAdminAction) {
      logger.warn(
        { reqToken },
        "User is not authorized to assign teacher to subject in the specified schools."
      );
      return handleError(
        res,
        "You are not authorized to assign teacher to subject in the specified schools.",
        403
      );
    }
    const { id } = req.params;
    const { teacherId,  } = req.body;

    const teacherExists = await prisma.staff.findUnique({
      where: { id: teacherId },
    });
    if (!teacherExists) {
      return handleError(res, "Teacher not found", 404);
    }

    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      return handleError(res, "Subject not found", 404);
    }

    const updatedSubject = await prisma.subject.update({
      where: { id },
      data: { teacherId },
      include: { teacher: true },
    });

    res.json({
      success: true,
      message: "Teacher assigned",
      data: updatedSubject,
    });
  } catch (error) {
    logger.error("Failed to assign teacher");
    next(error);
  }
};
