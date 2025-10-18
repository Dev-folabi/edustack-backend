import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import logger from "../utils/logger";
import { handleError } from "../error/errorHandler";
import { checkIfAdminAction } from "../function/schoolFunctions";
import { PrismaClient } from "@prisma/client";
import {
  CreateEntryRequest,
  CreateTimetableRequest,
  UpdateEntryRequest,
  UpdateTimetableRequest,
} from "../types/requests";
import { TEACHER_ROLES } from "../config/constants";
import { paginateResults } from "../function/pagination";

type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Create a class timetable
 * @route POST /api/timetables
 */
export const createTimetable = async (
  req: Request<{}, {}, CreateTimetableRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { schoolId, classId, sectionId, sessionId, termId, status, entries } =
      req.body;

    const reqToken = (req as any).user;
    const isAdminAction = await checkIfAdminAction(
      reqToken,
      [schoolId],
      [...TEACHER_ROLES]
    );
    if (!isAdminAction) {
      return handleError(
        res,
        "You are not authorized to create a timetable for this school.",
        403
      );
    }

    // Validate school, section, session, term
    const [school, section, session, term] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId, isActive: true } }),
      prisma.class_Section.findUnique({
        where: { id: sectionId, classId },
        include: { classes: true },
      }),
      prisma.session.findUnique({ where: { id: sessionId } }),
      termId
        ? prisma.term.findUnique({ where: { id: termId } })
        : Promise.resolve(null),
    ]);

    if (!school) return handleError(res, "Invalid or inactive school.", 400);
    if (!section) return handleError(res, "Invalid class section.", 400);
    if (!session) return handleError(res, "Invalid session.", 400);
    if (termId && !term) return handleError(res, "Invalid term.", 400);

    const timetable = await prisma.$transaction(async (tx) => {
      const existingTimetable = await tx.timetable.findFirst({
        where: {
          schoolId,
          sectionId,
          sessionId,
          termId: termId ?? null,
        },
      });

      if (existingTimetable) {
        return tx.timetable.update({
          where: { id: existingTimetable.id },
          data: {
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
      } else {
        return tx.timetable.create({
          data: {
            schoolId,
            classId: section.classId,
            sectionId,
            sessionId,
            termId,
            name: `${section.classes.name}-${section.name}`,
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
      }
    });

    logger.info(
      { timetableId: timetable.id },
      "Timetable created/updated successfully."
    );
    res.status(201).json({
      success: true,
      message: "Timetable created/updated successfully.",
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
export const getSchoolTimetables = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { schoolId } = req.params;
    const page = parseInt(req.query?.page as string, 12);
    const limit = parseInt(req.query?.limit as string, 12);

    const timetables = await prisma.timetable.findMany({
      where: { schoolId },
      include: {
        entries: {
          select: {
            id: true,
            day: true,
            startTime: true,
            endTime: true,
            type: true,
            subject: { select: { name: true, id: true } },
            teacher: { select: { name: true, id: true } },
          },
        },
        section: true,
        session: true,
        term: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const totalRecords = await prisma.timetable.count({
      where: { schoolId },
    });

    res.status(200).json({
      success: true,
      message: "School timetables retrieved successfully.",
      data: paginateResults(timetables, page, limit, totalRecords),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get timetable for a specific class section
 * @route GET /api/timetables/class/:sectionId
 */
export const getClassTimetable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sectionId } = req.params;
    const timetable = await prisma.timetable.findFirst({
      where: { sectionId },
      include: {
        entries: {
          select: {
            id: true,
            day: true,
            startTime: true,
            endTime: true,
            type: true,
            subject: { select: { name: true, id: true } },
            teacher: { select: { name: true, id: true } },
          },
        },
        section: true,
        session: true,
        term: true,
      },
      orderBy: { createdAt: "desc" },
    });

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
 * Delete a timetable
 * @route DELETE /api/timetables/:timetableId
 */
export const deleteTimetable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { timetableId } = req.params;

    const existingTimetable = await prisma.timetable.findUnique({
      where: { id: timetableId },
    });
    if (!existingTimetable)
      return handleError(res, "Timetable not found.", 404);

    const reqToken = (req as any).user;
    const isAdminAction = await checkIfAdminAction(
      reqToken,
      [existingTimetable.schoolId],
      [...TEACHER_ROLES]
    );

    if (!isAdminAction) {
      return handleError(
        res,
        "You are not authorized to delete this timetable.",
        403
      );
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

/**
 * Create a timetable entry
 * @route POST /api/timetables/entries
 */
export const createEntry = async (
  req: Request<{}, {}, CreateEntryRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { timetableId, day, startTime, endTime, subjectId, teacherId, type } =
      req.body;

    // Validate timetable exists
    const timetable = await prisma.timetable.findUnique({
      where: { id: timetableId },
    });
    if (!timetable) return handleError(res, "Timetable not found.", 404);

    // Check authorization
    const reqToken = (req as any).user;
    const isAdminAction = await checkIfAdminAction(
      reqToken,
      [timetable.schoolId],
      [...TEACHER_ROLES]
    );
    if (!isAdminAction) {
      return handleError(
        res,
        "You are not authorized to add entries to this timetable.",
        403
      );
    }

    // Validate subject and teacher if provided
    const [subject, teacher] = await Promise.all([
      subjectId
        ? prisma.subject.findUnique({ where: { id: subjectId } })
        : null,
      teacherId ? prisma.staff.findUnique({ where: { id: teacherId } }) : null,
    ]);

    if (subjectId && !subject) return handleError(res, "Invalid subject.", 400);
    if (teacherId && !teacher) return handleError(res, "Invalid teacher.", 400);

    // Check for time conflicts
    const existingEntry = await prisma.entry.findFirst({
      where: {
        timetableId,
        day: { equals: day },
        OR: [
          {
            // New entry starts during an existing entry
            AND: [
              { startTime: { lte: new Date(startTime) } },
              { endTime: { gt: new Date(startTime) } },
            ],
          },
          {
            // New entry ends during an existing entry
            AND: [
              { startTime: { lt: new Date(endTime) } },
              { endTime: { gte: new Date(endTime) } },
            ],
          },
          {
            // New entry completely contains an existing entry
            AND: [
              { startTime: { gte: new Date(startTime) } },
              { endTime: { lte: new Date(endTime) } },
            ],
          },
        ],
      },
    });

    if (existingEntry) {
      return handleError(
        res,
        "Time conflict with an existing entry in the timetable.",
        400
      );
    }

    // Create the entry
    const entry = await prisma.entry.create({
      data: {
        timetableId,
        day,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        subjectId,
        teacherId,
        type: type || "REGULAR",
      },
    });

    logger.info({ entryId: entry.id }, "Timetable entry created successfully.");
    res.status(201).json({
      success: true,
      message: "Timetable entry created successfully.",
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a timetable entry
 * @route PUT /api/timetables/entries/:entryId
 */
export const updateEntry = async (
  req: Request<{ entryId: string }, {}, UpdateEntryRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { entryId } = req.params;
    const { day, startTime, endTime, subjectId, teacherId, type } = req.body;

    // Validate entry exists
    const existingEntry = await prisma.entry.findUnique({
      where: { id: entryId },
      include: { timetable: true },
    });
    if (!existingEntry) return handleError(res, "Entry not found.", 404);

    // Check authorization
    const reqToken = (req as any).user;
    const isAdminAction = await checkIfAdminAction(
      reqToken,
      [existingEntry.timetable.schoolId],
      [...TEACHER_ROLES]
    );
    if (!isAdminAction) {
      return handleError(
        res,
        "You are not authorized to update this timetable entry.",
        403
      );
    }

    // Validate subject and teacher if provided
    const [subject, teacher] = await Promise.all([
      subjectId
        ? prisma.subject.findUnique({ where: { id: subjectId } })
        : Promise.resolve(null),
      teacherId
        ? prisma.staff.findUnique({ where: { id: teacherId } })
        : Promise.resolve(null),
    ]);

    if (subjectId && !subject) return handleError(res, "Invalid subject.", 400);
    if (teacherId && !teacher) return handleError(res, "Invalid teacher.", 400);

    // Check for time conflicts if time is being updated
    if (day || startTime || endTime) {
      const newDay = day || existingEntry.day;
      const newStartTime = startTime
        ? new Date(startTime)
        : existingEntry.startTime;
      const newEndTime = endTime ? new Date(endTime) : existingEntry.endTime;

      const conflictingEntry = await prisma.entry.findFirst({
        where: {
          timetableId: existingEntry.timetableId,
          day: { equals: newDay },
          id: { not: entryId },
          OR: [
            {
              // New entry starts during an existing entry
              AND: [
                { startTime: { lte: newStartTime } },
                { endTime: { gt: newStartTime } },
              ],
            },
            {
              // New entry ends during an existing entry
              AND: [
                { startTime: { lt: newEndTime } },
                { endTime: { gte: newEndTime } },
              ],
            },
            {
              // New entry completely contains an existing entry
              AND: [
                { startTime: { gte: newStartTime } },
                { endTime: { lte: newEndTime } },
              ],
            },
          ],
        },
      });

      if (conflictingEntry) {
        return handleError(
          res,
          "Time conflict with an existing entry in the timetable.",
          400
        );
      }
    }

    // Update the entry
    const updatedEntry = await prisma.entry.update({
      where: { id: entryId },
      data: {
        day: day || existingEntry.day,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        subjectId: subjectId || existingEntry.subjectId,
        teacherId: teacherId || existingEntry.teacherId,
        type: type || existingEntry.type,
      },
    });

    logger.info({ entryId }, "Timetable entry updated successfully.");
    res.status(200).json({
      success: true,
      message: "Timetable entry updated successfully.",
      data: updatedEntry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a timetable entry
 * @route DELETE /api/timetables/entries/:entryId
 */
export const deleteEntry = async (
  req: Request<{ entryId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { entryId } = req.params;

    // Validate entry exists
    const existingEntry = await prisma.entry.findUnique({
      where: { id: entryId },
      include: { timetable: true },
    });
    if (!existingEntry) return handleError(res, "Entry not found.", 404);

    // Check authorization
    const reqToken = (req as any).user;
    const isAdminAction = await checkIfAdminAction(
      reqToken,
      [existingEntry.timetable.schoolId],
      [...TEACHER_ROLES]
    );
    if (!isAdminAction) {
      return handleError(
        res,
        "You are not authorized to delete this timetable entry.",
        403
      );
    }

    // Delete the entry
    await prisma.entry.delete({
      where: { id: entryId },
    });

    logger.info({ entryId }, "Timetable entry deleted successfully.");
    res.status(200).json({
      success: true,
      message: "Timetable entry deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a timetable
 * @route PUT /api/timetables/:timetableId
 */
export const updateTimetable = async (
  req: Request<{ timetableId: string }, {}, UpdateTimetableRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { timetableId } = req.params;
    const { schoolId, classId, sectionId, sessionId, termId, status,  } =
      req.body;

    // Check if timetable exists
    const existingTimetable = await prisma.timetable.findUnique({
      where: { id: timetableId },
      include: { entries: true },
    });

    if (!existingTimetable) {
      return handleError(res, "Timetable not found.", 404);
    }

    // Authorization check
    const reqToken = (req as any).user;
    const isAdminAction = await checkIfAdminAction(
      reqToken,
      [existingTimetable.schoolId],
      [...TEACHER_ROLES]
    );

    if (!isAdminAction) {
      return handleError(
        res,
        "You are not authorized to update this timetable.",
        403
      );
    }

    // Validate school, section, session, term
    const [school, section, session, term] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId, isActive: true } }),
      prisma.class_Section.findUnique({
        where: { id: sectionId, classId },
        include: { classes: true },
      }),
      prisma.session.findUnique({ where: { id: sessionId } }),
      termId
        ? prisma.term.findUnique({ where: { id: termId } })
        : Promise.resolve(null),
    ]);

    if (!school) return handleError(res, "Invalid or inactive school.", 400);
    if (!section) return handleError(res, "Invalid class section.", 400);
    if (!session) return handleError(res, "Invalid session.", 400);
    if (termId && !term) return handleError(res, "Invalid term.", 400);

    const timetable = await prisma.$transaction(async (tx) => {
      const existingTimetable = await tx.timetable.findFirst({
        where: {
          schoolId,
          sectionId,
          sessionId,
          termId: termId ?? null,
        },
      });

      if (existingTimetable) {
        return tx.timetable.update({
          where: { id: existingTimetable.id },
          data: {
            status,
          },
          include: { entries: true },
        });
      } else {
        return tx.timetable.create({
          data: {
            schoolId,
            classId: section.classId,
            sectionId,
            sessionId,
            termId,
            name: `${section.classes.name}-${section.name}`,
            status,
          },
          include: { entries: true },
        });
      }
    });

    logger.info(
      { timetableId: timetable.id },
      "Timetable created/updated successfully."
    );
    res.status(201).json({
      success: true,
      message: "Timetable created/updated successfully.",
      data: timetable,
    });
  } catch (error) {
    next(error);
  }
};
