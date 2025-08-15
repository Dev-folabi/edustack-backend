import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import logger from "../utils/logger";
import { handleError } from "../error/errorHandler";
import { checkIfAdminAction } from "../function/schoolFunctions";
import { PrismaClient } from "@prisma/client";

type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Create a class timetable
 * @route POST /api/timetables
 */
export const createTimetable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      schoolId,
      sectionId,
      sessionId,
      termId,
      name,
      status,
      entries,
    } = req.body;

    const reqToken = (req as any).user;
    const isAdminAction = await checkIfAdminAction(reqToken, [schoolId]);
    if (!isAdminAction) {
      return handleError(res, "You are not authorized to create a timetable for this school.", 403);
    }

    // Validate school, section, session, term
    const [school, section, session, term] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId, isActive: true } }),
      prisma.class_Section.findUnique({ where: { id: sectionId } }),
      prisma.session.findUnique({ where: { id: sessionId } }),
      termId ? prisma.term.findUnique({ where: { id: termId } }) : Promise.resolve(null),
    ]);

    if (!school) return handleError(res, "Invalid or inactive school.", 400);
    if (!section) return handleError(res, "Invalid section.", 400);
    if (!session) return handleError(res, "Invalid session.", 400);
    if (termId && !term) return handleError(res, "Invalid term.", 400);

    // Create timetable + entries
    const timetable = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const createdTimetable = await tx.timetable.create({
        data: {
          schoolId,
          sectionId,
          sessionId,
          termId,
          name,
          status,
          entries: {
            create: entries.map((e: any) => ({
              day: e.day,
              startTime: new Date(e.startTime),
              endTime: new Date(e.endTime),
              subjectId: e.subjectId,
              teacherId: e.teacherId,
              type: e.type,
            })),
          },
        },
        include: { entries: true },
      });
      return createdTimetable;
    });

    logger.info({ timetableId: timetable.id }, "Timetable created successfully.");
    res.status(201).json({
      success: true,
      message: "Timetable created successfully.",
      data: timetable,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all timetables for a school
 * @route GET /api/timetables/school/:schoolId
 */
export const getSchoolTimetables = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { schoolId } = req.params;
    const timetables = await prisma.timetable.findMany({
      where: { schoolId },
      include: { entries: true, section: true, session: true, term: true },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "School timetables retrieved successfully.",
      data: timetables,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get timetable for a specific class section
 * @route GET /api/timetables/class/:sectionId
 */
export const getClassTimetable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sectionId } = req.params;
    const timetable = await prisma.timetable.findFirst({
      where: { sectionId },
      include: { entries: true, section: true, session: true, term: true },
      orderBy: { createdAt: "desc" },
    });

    if (!timetable) return handleError(res, "No timetable found for this class section.", 404);

    res.status(200).json({
      success: true,
      message: "Class timetable retrieved successfully.",
      data: timetable,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a class timetable (including entries)
 * @route PUT /api/timetables/:timetableId
 */
export const updateTimetable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { timetableId } = req.params;
    const { name, status, entries } = req.body;

    const existingTimetable = await prisma.timetable.findUnique({
      where: { id: timetableId },
      include: { entries: true },
    });
    if (!existingTimetable) return handleError(res, "Timetable not found.", 404);

    const reqToken = (req as any).user;
    const isAdminAction = await checkIfAdminAction(reqToken, [existingTimetable.schoolId]);
    if (!isAdminAction) {
      return handleError(res, "You are not authorized to update this timetable.", 403);
    }

    const updatedTimetable = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      // Delete old entries and recreate
      await tx.entry.deleteMany({ where: { timetableId } });

      return tx.timetable.update({
        where: { id: timetableId },
        data: {
          name,
          status,
          entries: {
            create: entries.map((e: any) => ({
              day: e.day,
              startTime: new Date(e.startTime),
              endTime: new Date(e.endTime),
              subjectId: e.subjectId,
              teacherId: e.teacherId,
              type: e.type,
            })),
          },
        },
        include: { entries: true },
      });
    });

    logger.info({ timetableId }, "Timetable updated successfully.");
    res.status(200).json({
      success: true,
      message: "Timetable updated successfully.",
      data: updatedTimetable,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a timetable
 * @route DELETE /api/timetables/:timetableId
 */
export const deleteTimetable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { timetableId } = req.params;

    const existingTimetable = await prisma.timetable.findUnique({
      where: { id: timetableId },
    });
    if (!existingTimetable) return handleError(res, "Timetable not found.", 404);

    const reqToken = (req as any).user;
    const isAdminAction = await checkIfAdminAction(reqToken, [existingTimetable.schoolId]);
    if (!isAdminAction) {
      return handleError(res, "You are not authorized to delete this timetable.", 403);
    }

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await tx.entry.deleteMany({ where: { timetableId } });
      await tx.timetable.delete({ where: { id: timetableId } });
    });

    logger.info({ timetableId }, "Timetable deleted successfully.");
    res.status(200).json({
      success: true,
      message: "Timetable deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
