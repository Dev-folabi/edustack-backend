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
    const { name, code, isActive = true, schoolIds, sectionIds } = req.body;

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

    const createdSubjects = await prisma.$transaction(
      async (tx: PrismaTransactionClient) => {
        const subjects = await Promise.all(
          uniqueSectionIds.map(async (sectionId) => {
            return tx.subject.create({
              data: {
                name,
                code,
                isActive,
                schools: {
                  create: uniqueSchoolIds.map((schoolId) => ({ schoolId })),
                },
                sections: {
                  create: [{ sectionId }],
                },
              },
            });
          })
        );
        return subjects;
      }
    );

    logger.info(
      { subjectId: createdSubjects.map((s) => s.id) },
      "Subject created successfully."
    );
    res.status(201).json({
      success: true,
      message: "Subject created successfully.",
      data: createdSubjects,
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
        schools: { include: { school: { select: { id: true, name: true } } } },
        sections: {
          include: {
            section: {
              select: {
                id: true,
                name: true,
                classId: true,
                classes: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        teacher: { select: { id: true, name: true } },
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
      return handleError(res, "Subject not found", 404);
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
    const { name, code, isActive } = req.body;
    const { id } = req.params;

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        schools: true,
        sections: true,
      },
    });

    if (!subject) {
      return handleError(res, "Subject not found", 404);
    }

    const isAdminAction = await checkIfAdminAction(
      reqToken,
      subject.schools.map((s) => s.schoolId)
    );
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
    const updated = await prisma.subject.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        schools: true,
        sections: true,
        teacher: true,
      },
    });
    updatedSubjects.push(updated);

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
        sections: true,
        attendance: true,
        timetables: true,
        ExamPaper: true,
        QuestionBank: true,
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
        "User is not authorized to delete a subject in the specified schools."
      );
      return handleError(
        res,
        "You are not authorized to delete a subject in the specified schools.",
        403
      );
    }

    // Check if subject has related records that prevent deletion
    const hasRelatedRecords =
      existingSubject.attendance.length > 0 ||
      existingSubject.timetables.length > 0 ||
      existingSubject.ExamPaper.length > 0 ||
      existingSubject.QuestionBank.length > 0;

    if (hasRelatedRecords) {
      return handleError(
        res,
        "Cannot delete subject with existing attendance, timetables, exam papers, or question bank records. Consider deactivating instead.",
        400
      );
    }

    // Delete related records in transaction
    const subject = await prisma.$transaction(async (tx) => {
      // Delete SubjectSchool relationships
      await tx.subjectSchool.deleteMany({
        where: { subjectId: id },
      });

      // Delete SubjectSection relationships
      await tx.subjectSection.deleteMany({
        where: { subjectId: id },
      });

      // Finally delete the subject
      return await tx.subject.delete({
        where: { id },
      });
    });

    logger.info(
      { subjectId: id, subjectName: subject.name },
      "Subject and related records deleted successfully."
    );

    res.json({
      success: true,
      message: "Subject deleted successfully",
      data: subject,
    });
  } catch (error) {
    logger.error(
      { error, subjectId: req.params.id },
      "Failed to delete subject"
    );
    res.status(500).json({
      success: false,
      message: "Failed to delete subject",
      error,
    });
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
    const { teacherId } = req.body;

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
