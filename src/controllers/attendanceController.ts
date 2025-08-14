import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import logger from "../utils/logger";
import { handleError } from "../error/errorHandler";
import { PrismaClient } from "@prisma/client";
import {
  StaffAttendanceRequest,
  StudentAttendanceRequest,
} from "../types/requests";
import { ATTENDANCE_TYPE } from "../config/constants";
import { paginateResults } from "../function/pagination";
import { checkIfAdminAction } from "../function/schoolFunctions";

type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const deriveDateParts = (dateInput: string | Date) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");

  const normalized = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const month = normalized.getUTCMonth() + 1;
  const year = normalized.getUTCFullYear();
  return { date: normalized, month, year };
};

const getStaffForRequester = async (req: Request) => {
  const reqToken = (req as any).user as string | undefined;
  if (!reqToken) return null;
  const staff = await prisma.staff.findUnique({ where: { userId: reqToken } });
  return staff;
};

// Check that a given section is owned by this class teacher
const ensureClassTeacherOwnsSection = async (
  teacherId: string,
  sectionId: string
) => {
  const section = await prisma.class_Section.findUnique({
    where: { id: sectionId },
    select: { id: true, teacherId: true },
  });
  return !!section && section.teacherId === teacherId;
};

// Check that a subject is taught by teacher AND is linked to the section
const ensureSubjectTeacherForSection = async (
  teacherId: string,
  subjectId: string,
  sectionId: string
) => {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      sections: { where: { sectionId }, select: { sectionId: true } },
    },
  });
  if (!subject) return false;
  const teaches = subject.teacherId === teacherId;
  const boundToSection = subject.sections.some(
    (s) => s.sectionId === sectionId
  );
  return teaches && boundToSection;
};

/**
 * Class teacher takes attendance for a section.
 * @route POST /api/attendance/section
 * body: { sectionId: string, date: string|Date, records: { studentId, status, notes? }[] }
 */
export const takeSectionAttendance = async (
  req: Request<{}, {}, StudentAttendanceRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const staff = await getStaffForRequester(req);
    if (!staff)
      return handleError(
        res,
        "Only teachers can take section attendance.",
        403
      );

    const { sectionId, date, records } = req.body;

    // Authorization: must be the class teacher of this section
    const owns = await ensureClassTeacherOwnsSection(staff.id, sectionId);
    if (!owns)
      return handleError(
        res,
        "You are not assigned as class teacher for this section.",
        403
      );

    const { date: normDate, month, year } = deriveDateParts(date);

    const studentIds = [...new Set(records.map((r) => r.studentId))];
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { sectionId, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const enrolledSet = new Set(enrollments.map((e) => e.studentId));
    const invalid = studentIds.filter((sid) => !enrolledSet.has(sid));
    if (invalid.length) {
      return handleError(res, `Some students are not in this section`, 400);
    }

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      for (const r of records) {
        const updateRes = await tx.attendance.updateMany({
          where: {
            date: normDate,
            studentId: r.studentId,
            sectionId,
            subjectId: null,
            attendanceType: ATTENDANCE_TYPE.STUDENT,
          },
          data: {
            status: r.status,
            notes: r.notes ?? null,
            month,
            year,
          },
        });
        if (updateRes.count === 0) {
          await tx.attendance.create({
            data: {
              date: normDate,
              month,
              year,
              status: r.status,
              notes: r.notes ?? null,
              studentId: r.studentId,
              staffId: staff.id,
              sectionId,
              attendanceType: ATTENDANCE_TYPE.STUDENT,
              subjectId: null,
            },
          });
        }
      }
    });

    logger.info(
      { sectionId, takenBy: staff.id, count: records.length },
      "Section attendance recorded."
    );
    res.status(201).json({ success: true, message: "Attendance recorded." });
  } catch (err) {
    next(err);
  }
};

/**
 * Subject teacher takes attendance for a section & subject.
 * @route POST /api/attendance/subject
 * body: { sectionId, subjectId, date, records: [{ studentId, status, notes? }] }
 */
export const takeSubjectAttendance = async (
  req: Request<{}, {}, StudentAttendanceRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const staff = await getStaffForRequester(req);
    if (!staff)
      return handleError(
        res,
        "Only subject teachers can take subject attendance.",
        403
      );

    const { sectionId, subjectId, date, records } = req.body;

    // Authorization: teacher must be assigned to this subject and subject must be linked to section
    const allowed = await ensureSubjectTeacherForSection(
      staff.id,
      subjectId!,
      sectionId
    );
    if (!allowed)
      return handleError(
        res,
        "You are not assigned to this subject/section.",
        403
      );

    const { date: normDate, month, year } = deriveDateParts(date);

    // Verify students belong to section
    const studentIds = [...new Set(records.map((r) => r.studentId))];
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { sectionId, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const enrolledSet = new Set(enrollments.map((e) => e.studentId));
    const invalid = studentIds.filter((sid) => !enrolledSet.has(sid));
    if (invalid.length) {
      return handleError(res, `Some students are not in this section`, 400);
    }

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      for (const r of records) {
        const updateRes = await tx.attendance.updateMany({
          where: {
            date: normDate,
            studentId: r.studentId,
            sectionId,
            subjectId,
            attendanceType: ATTENDANCE_TYPE.STUDENT,
          },
          data: {
            status: r.status,
            notes: r.notes ?? null,
            month,
            year,
          },
        });
        if (updateRes.count === 0) {
          await tx.attendance.create({
            data: {
              date: normDate,
              month,
              year,
              status: r.status,
              notes: r.notes ?? null,
              studentId: r.studentId,
              staffId: staff.id,
              sectionId,
              subjectId,
              attendanceType: ATTENDANCE_TYPE.STUDENT,
            },
          });
        }
      }
    });

    logger.info(
      { sectionId, subjectId, takenBy: staff.id, count: records.length },
      "Subject attendance recorded."
    );
    res.status(201).json({ success: true, message: "Attendance recorded." });
  } catch (err) {
    next(err);
  }
};

/**
 * View student attendance by section & date or section & subject.
 * @route GET /api/attendance/student
 * query: sectionId (required), date? (ISO), subjectId?, month?, year?, studentId?
 */
export const getStudentAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(parseInt(req.query?.page as string, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query?.limit as string, 10) || 10, 1);

    const { sectionId, date, subjectId, month, year, studentId } =
      req.query as Record<string, string | undefined>;

    if (!sectionId) return handleError(res, "sectionId is required.", 400);

    const where: any = { sectionId, attendanceType: ATTENDANCE_TYPE.STUDENT };

    if (studentId) where.studentId = studentId;

    if (subjectId) {
      where.subjectId = subjectId;
    } else {
      where.subjectId = null;
    }

    if (date) {
      const { date: normDate } = deriveDateParts(date);
      where.date = normDate;
    } else {
      if (year) where.year = Number(year);
      if (month) where.month = Number(month);
    }

    const rows = await prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { studentId: "asc" }],
      include: {
        student: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    const count = rows.length;

    res.status(200).json({
      success: true,
      message: "Attendance fetched.",
      data: paginateResults(rows, page, limit, count),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin takes staff attendance.
 * @route POST /api/attendance/staff
 * body: { date: string|Date, records: [{ staffId, status, notes? }] }
 */
export const takeStaffAttendance = async (
  req: Request<{}, {}, StaffAttendanceRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const reqUserId = (req as any).user as string | undefined;
    if (!reqUserId) return handleError(res, "Unauthorized.", 401);

    const isAdminAction = checkIfAdminAction(reqUserId);
    if (!isAdminAction)
      return handleError(res, "Only admin can take staff attendance.", 403);

    const { date, records } = req.body;

    const { date: normDate, month, year } = deriveDateParts(date);

    // Validate staffIds exist
    const staffIds = [...new Set(records.map((r) => r.staffId))];
    const existingStaff = await prisma.staff.findMany({
      where: { id: { in: staffIds } },
      select: { id: true },
    });
    const existingSet = new Set(existingStaff.map((s) => s.id));
    const missing = staffIds.filter((id) => !existingSet.has(id));
    if (missing.length) {
      return handleError(res, `Unknown staff ${missing.join(", ")}`, 400);
    }

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      for (const r of records) {
        const updateRes = await tx.attendance.updateMany({
          where: {
            date: normDate,
            staffId: r.staffId,
            attendanceType: ATTENDANCE_TYPE.STAFF,
          },
          data: {
            status: r.status,
            notes: r.notes ?? null,
            month,
            year,
          },
        });
        if (updateRes.count === 0) {
          await tx.attendance.create({
            data: {
              date: normDate,
              month,
              year,
              status: r.status,
              notes: r.notes ?? null,
              staffId: r.staffId,
              attendanceType: ATTENDANCE_TYPE.STAFF,
            },
          });
        }
      }
    });

    logger.info(
      { takenBy: reqUserId, count: records.length },
      "Staff attendance recorded."
    );
    res.status(201).json({ success: true, message: "Attendance recorded." });
  } catch (err) {
    next(err);
  }
};

/**
 * View staff attendance by date or by month/year (optionally filter by staffId).
 * @route GET /api/attendance/staff
 * query: date? month? year? staffId?
 */
export const getStaffAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(parseInt(req.query?.page as string, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query?.limit as string, 10) || 10, 1);

    const { date, month, year, staffId } = req.query as Record<
      string,
      string | undefined
    >;

    const where: any = {
      staffId: { not: null },
      attendanceType: ATTENDANCE_TYPE.STAFF,
    };
    if (staffId) where.staffId = staffId;

    if (date) {
      const { date: normDate } = deriveDateParts(date);
      where.date = normDate;
    } else {
      if (year) where.year = Number(year);
      if (month) where.month = Number(month);
    }

    const rows = await prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { staffId: "asc" }],
      include: { staff: { select: { id: true, name: true } } },
    });

    const count = rows.length;

    res.status(200).json({
      success: true,
      message: "Staff attendance fetched.",
      data: paginateResults(rows, page, limit, count),
    });
  } catch (err) {
    next(err);
  }
};
