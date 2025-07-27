import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { handleError } from "../error/errorHandler";
import {
  PromoteStudentRequest,
  TransferStudentRequest,
} from "../types/requests";
import { getIdFromToken } from "../function/token";
import {
  findActiveSession,
  findClassWithSections,
} from "../function/schoolFunctions";
import _ from "lodash";
import { Prisma, Student, Classes, Class_Section as ClassSection, Session, Term } from ".prisma/client"; // Import Prisma types
import logger from "../utils/logger";

// The enrollStudent function is commented out in the original source.
// If it were to be used, it would handle enrolling a student into a class and section.
// export const enrollStudent = async (...) => { ... };

/**
 * Retrieves a list of students for a given school.
 * Supports filtering by classId, student name, admission number, and active status.
 * @route GET /api/students/:schoolId/all (example, actual route in studentRoutes)
 */
export const getStudentsBySchool = async (
  req: Request<
    { schoolId: string }, {}, {},
    { classId?: string; name?: string; admissionNumber?: string; active?: string; }
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const { schoolId } = req.params;
    const { classId, name, admissionNumber, active } = req.query;

    if (!schoolId || schoolId.trim() === "" || schoolId.trim() === ":schoolId") {
      logger.warn({ providedSchoolId: schoolId, path: req.path }, "Invalid school ID format in getStudentsBySchool params");
      return handleError(res, "A valid School ID is required in the path parameters.", 400);
    }

    const filters: Prisma.UserSchoolWhereInput = {
      schoolId, role: "student",
      user: {
        student: {
          ...(classId && { student_enrolled: { some: { classId: { equals: classId }, status: 'enrolled'}}}),
          ...(name && { name: { contains: name, mode: "insensitive" } }),
          ...(admissionNumber && { admission_number: parseInt(admissionNumber, 10) }),
          ...(active !== undefined && { isActive: active === "true" }),
        },
      },
    };

    const studentsUserSchools = await prisma.userSchool.findMany({
      where: filters,
      include: {
        school: { select: { name: true } },
        user: {
          include: {
            student: {
              include: {
                student_enrolled: {
                    where: { status: "enrolled" },
                    include: { class: {select: {label:true}}, section: {select: {label:true}} },
                    orderBy: { createdAt: 'desc' }
                },
              },
            },
          },
        },
      },
    });

    const cleanedStudents = studentsUserSchools.map((us) => {
      if (!us.user || !us.user.student) return null;
      const currentEnrollment = us.user.student.student_enrolled[0];
      return {
        userId: us.user.id, studentId: us.user.student.id, email: us.user.email, username: us.user.username,
        schoolId: us.schoolId, schoolName: us.school.name, role: us.role,
        ..._.omit(us.user.student, ["createdAt", "updatedAt", "userId", "student_enrolled", "user"]),
        currentClass: currentEnrollment?.class?.label, currentSection: currentEnrollment?.section?.label,
      };
    }).filter(s => s !== null);

    logger.info({ schoolId, filterCount: Object.keys(req.query).length, resultCount: cleanedStudents.length }, "Students fetched for school.");
    res.status(200).json({
      success: true, message: "Students fetched successfully.", data: cleanedStudents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves detailed information for a specific student by their ID.
 * @route GET /api/students/:studentId
 */
export const getStudentDetails = async (
  req: Request<{ studentId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    if (!studentId) return handleError(res, "Student ID is required.", 400);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { email: true, username: true } },
        parent: { select: { name: true, phone: true, email: true } },
        student_enrolled: {
          where: { status: 'enrolled' }, orderBy: { createdAt: 'desc' }, take: 1,
          include: {
            class: { select: { label: true } }, section: { select: { label: true } },
            session: { select: { label: true } },
          },
        },
      },
    });

    if (!student) {
      logger.warn({ studentId }, "Student not found for getStudentDetails.");
      return handleError(res, "Student not found.", 404);
    }

    const currentEnrollment = student.student_enrolled[0];
    const enrollmentDetails = currentEnrollment ? {
        class: currentEnrollment.class.label, section: currentEnrollment.section.label,
        session: currentEnrollment.session.label,
    } : {};

    const data = {
      ..._.omit(student, ["student_enrolled", "user", "parent", "userId", "parentId"]),
      email: student.user?.email, username: student.user?.username,
      parentDetails: student.parent, enrollment: enrollmentDetails,
    };
    logger.info({ studentId }, "Student details fetched successfully.");
    res.status(200).json({ success: true, message: "Student details fetched successfully.", data });
  } catch (error) {
    next(error);
  }
};

/**
 * Validates prerequisites for student promotion.
 * @returns An object with success status and validated data, or an error object.
 */
const _validatePromotionPrerequisites = async (
    fromClassId: string,
    toClassId: string,
    sectionId: string,
    studentIdsForFirstCheck: string[] // Only used to get the first student for session check
) => {
    const fromClass = await findClassWithSections(fromClassId);
    if (!fromClass) return { success: false, error: { message: "Originating class not found.", status: 404 } };

    const toClass = await findClassWithSections(toClassId);
    if (!toClass) return { success: false, error: { message: "Destination class not found.", status: 404 } };

    const sectionInfo = toClass.sections.find((section) => section.id === sectionId);
    if (!sectionInfo) return { success: false, error: { message: "Section not found in the destination class.", status: 404 } };

    if (fromClass.schoolId !== toClass.schoolId) {
      logger.warn({fromClassSchool: fromClass.schoolId, toClassSchool: toClass.schoolId}, "Cross-school promotion attempt denied.");
      return { success: false, error: { message: "Destination class must be in the same school.", status: 400 } };
    }

    const activeSession = await findActiveSession();
    if (!activeSession) return { success: false, error: { message: "No active session found for promotion. Please ensure an academic session is active.", status: 400 }};

    const activeTerm = activeSession.terms.find((term) => term.isActive);
    if (!activeTerm) return { success: false, error: { message: "No active term found in the session for promotion. Please ensure a term is active.", status: 400 }};

    const studentsToPromote = await prisma.student.findMany({ where: { id: { in: studentIdsForFirstCheck } }});
    if(studentsToPromote.length !== studentIdsForFirstCheck.length) {
        const foundIds = studentsToPromote.map(s => s.id);
        const notFoundIds = studentIdsForFirstCheck.filter(id => !foundIds.includes(id));
        logger.warn({ notFoundStudentIds: notFoundIds }, "One or more students to promote were not found during prerequisite check.");
        return { success: false, error: {message: `One or more students to promote were not found: ${notFoundIds.join(', ')}.`, status: 404}};
    }

    const firstStudentForCheck = studentsToPromote[0];
    const currentEnrollmentForSessionCheck = await prisma.studentEnrollment.findFirst({
        where: { studentId: firstStudentForCheck.id, classId: fromClassId, status: 'enrolled' },
        include: { session: true }, orderBy: { createdAt: "desc" },
    });

    if (currentEnrollmentForSessionCheck?.session) {
        const currentSessionStartDateStr = currentEnrollmentForSessionCheck.session.start_date?.toISOString();
        const activeSessionStartDateStr = activeSession.start_date?.toISOString();

        if (currentSessionStartDateStr && activeSessionStartDateStr) {
            const currentSessionStartDate = new Date(currentSessionStartDateStr);
            const activeSessionStartDate = new Date(activeSessionStartDateStr);

            if (isNaN(currentSessionStartDate.getTime()) || isNaN(activeSessionStartDate.getTime())) {
                logger.error({ activeSessionStart: activeSessionStartDateStr, currentStudentSessionStart: currentSessionStartDateStr, studentId: firstStudentForCheck.id }, "Invalid date format during promotion session check.");
                return { success: false, error: { message: "Invalid session date format. Cannot proceed.", status: 500 }};
            }
            if (activeSessionStartDate.getTime() <= currentSessionStartDate.getTime()) {
                logger.warn({ activeSessionStart: activeSession.start_date, currentStudentSessionStart: currentEnrollmentForSessionCheck.session.start_date, studentId: firstStudentForCheck.id }, "Promotion session date conflict.");
                return { success: false, error: { message: "Promotion must be to a new session that is chronologically after the student's current session.", status: 400 }};
            }
        } else {
            logger.warn({ studentId: firstStudentForCheck.id, fromClassId, activeSessionId: activeSession.id }, "Session start dates missing for promotion validation. Proceeding with caution.");
        }
    }
    return { success: true, data: { fromClass, toClass, sectionInfo, activeSession, activeTerm, studentsToPromote }};
};

/**
 * Promotes a list of students from one class to another within the same school.
 * @route PUT /api/students/promote
 */
export const promoteStudent = async (
  req: Request<{}, {}, PromoteStudentRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId: studentIds, fromClassId, toClassId, sectionId } = req.body;

    const promotedByUserId = getIdFromToken(req);
    if (!promotedByUserId) {
        logger.error("Failed to get user ID from token for promotion. Unauthorized.");
        return handleError(res, "User authentication failed, cannot perform promotion.", 401);
    }
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
        logger.warn({ providedStudentId: studentIds }, "Invalid studentId(s) for promotion: must be non-empty array.");
        return handleError(res, "studentId must be a non-empty array of student IDs.", 400);
    }

    const prereqResult = await _validatePromotionPrerequisites(fromClassId, toClassId, sectionId, studentIds);
    if (!prereqResult.success) {
        return handleError(res, prereqResult.error!.message, prereqResult.error!.status);
    }
    const { activeSession, activeTerm } = prereqResult.data!;

    await prisma.$transaction(async (tx) => {
      await tx.studentEnrollment.updateMany({
        where: { studentId: { in: studentIds }, classId: fromClassId, status: 'enrolled' },
        data: { status: "promoted" },
      });
      await tx.promotionHistory.createMany({
        data: studentIds.map((id) => ({
          studentId: id, fromClassId, toClassId,
          sessionId: activeSession.id, termId: activeTerm.id,
          promotedBy: promotedByUserId,
        })),
      });
      await tx.studentEnrollment.createMany({
        data: studentIds.map((id) => ({
          studentId: id, classId: toClassId, sectionId,
          sessionId: activeSession.id, termId: activeTerm.id,
          status: "enrolled",
        })),
      });
    });
    logger.info({ promotedStudentIds: studentIds, toClassId, toSectionId, byUser: promotedByUserId, sessionId: activeSession.id }, "Students promoted successfully.");
    res.status(200).json({ success: true, message: "Students promoted successfully." });
  } catch (error) {
    next(error);
  }
};


/**
 * Validates prerequisites for student transfer and fetches necessary context.
 * @returns An object with success status and validated data, or an error object.
 */
const _validateTransferPrerequisitesAndGetContext = async (
    studentIds: string[],
    toSchoolId: string,
    toClassId: string,
    toSectionId: string
) => {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      logger.warn({ providedStudentIds: studentIds }, "Invalid studentId(s) for transfer: must be non-empty array.");
      return { success: false, error: { message: "Student ID(s) are required and must be a non-empty array.", status: 400 }};
    }
    if (!toSchoolId || !toClassId || !toSectionId) {
      return { success: false, error: { message: "Target school, class, and section are required.", status: 400 }};
    }

    const students = await prisma.student.findMany({
        where: { id: { in: studentIds } },
        include: { user: { select: { name: true, id: true }} }
    });
    if (students.length !== studentIds.length) {
        const foundIds = students.map(s => s.id);
        const notFoundIds = studentIds.filter(id => !foundIds.includes(id));
        logger.warn({ notFoundStudentIds: notFoundIds }, "One or more students for transfer not found.");
        return { success: false, error: { message: `One or more students not found: ${notFoundIds.join(', ')}.`, status: 404 }};
    }

    let commonFromSchoolId: string | null = null;
    for (let i = 0; i < students.length; i++) {
        const student = students[i];
        const currentEnrollment = await prisma.studentEnrollment.findFirst({
            where: { studentId: student.id, status: 'enrolled' },
            include: { class: { select: { schoolId: true } } }, orderBy: { createdAt: 'desc' }
        });
        if (!currentEnrollment?.class?.schoolId) {
            const studentDisplayName = student.name || student.user?.name || student.id;
            logger.warn({ studentId: student.id, studentName: studentDisplayName }, `Could not determine current school for student transfer.`);
            return { success: false, error: { message: `Could not determine current school for student ${studentDisplayName}. Ensure student is actively enrolled.`, status: 400 }};
        }
        if (i === 0) commonFromSchoolId = currentEnrollment.class.schoolId;
        else if (currentEnrollment.class.schoolId !== commonFromSchoolId) {
            const studentDisplayName = student.name || student.user?.name || student.id;
            logger.warn({ studentId: student.id, studentName: studentDisplayName, expectedSchoolId: commonFromSchoolId, actualSchoolId: currentEnrollment.class.schoolId }, "Inconsistent origin schools in batch transfer.");
            return { success: false, error: { message: "All students in a batch transfer must belong to the same origin school.", status: 400 }};
        }
    }
    if (!commonFromSchoolId) {
        logger.error({ studentIdsProvided: studentIds}, "Failed to determine common origin school ID for transfer.");
        return { success: false, error: { message: "Could not determine a common origin school for the transfer.", status: 400 }};
    }
    const fromSchoolId = commonFromSchoolId;

    if (fromSchoolId === toSchoolId) {
        logger.warn({ studentIds, schoolId: fromSchoolId }, "Attempt to transfer students within the same school.");
        return { success: false, error: { message: "Cannot transfer students within the same school.", status: 400 }};
    }

    const [fromSchool, toSchool, targetClass, targetSection] = await Promise.all([
        prisma.school.findUnique({ where: { id: fromSchoolId, isActive: true } }),
        prisma.school.findUnique({ where: { id: toSchoolId, isActive: true } }),
        prisma.classes.findUnique({ where: { id: toClassId, schoolId: toSchoolId } }),
        prisma.class_Section.findUnique({ where: { id: toSectionId, classId: toClassId } }),
    ]);

    if (!fromSchool) return { success: false, error: { message: "Origin school not found or inactive.", status: 404 }};
    if (!toSchool) return { success: false, error: { message: "Target school not found or inactive.", status: 404 }};
    if (!targetClass) return { success: false, error: { message: "Target class not found or does not belong to the target school.", status: 404 }};
    if (!targetSection) return { success: false, error: { message: "Target section not found or does not belong to the target class.", status: 404 }};

    const activeSession = await findActiveSession();
    if (!activeSession) return { success: false, error: { message: "No active session found for transfer.", status: 400 }};
    const activeTerm = activeSession.terms.find((term) => term.isActive);
    if (!activeTerm) return { success: false, error: { message: "No active term found in session for transfer.", status: 400 }};

    return { success: true, data: { students, commonFromSchoolId: fromSchoolId, fromSchool, toSchool, targetClass, targetSection, activeSession, activeTerm }};
};


/**
 * Transfers a list of students from their current school to a new school, class, and section.
 * @route PUT /api/students/transfer
 */
export const transferStudent = async (
  req: Request<{}, {}, TransferStudentRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId: studentIds, toSchoolId, toClassId, toSectionId, transferReason } = req.body;
    const transferredByUserId = getIdFromToken(req);
     if (!transferredByUserId) {
        logger.error("Failed to get user ID from token for transfer. Unauthorized.");
        return handleError(res, "User authentication failed, cannot perform transfer.", 401);
    }

    const prereqResult = await _validateTransferPrerequisitesAndGetContext(studentIds, toSchoolId, toClassId, toSectionId);
    if(!prereqResult.success) {
        return handleError(res, prereqResult.error!.message, prereqResult.error!.status);
    }
    const { students, commonFromSchoolId: fromSchoolId, activeSession, activeTerm } = prereqResult.data!;

    const transferResultCount = await prisma.$transaction(async (tx) => {
      await tx.studentEnrollment.updateMany({
        where: { studentId: { in: studentIds }, status: "enrolled", class: { schoolId: fromSchoolId } },
        data: { status: "transferred" },
      });

      const studentUserIds = students.map(s => s.userId);
      await tx.userSchool.updateMany({
          where: { userId: {in: studentUserIds}, schoolId: fromSchoolId, role: 'student'},
          data: { schoolId: toSchoolId }
      });

      await tx.studentEnrollment.createMany({
        data: studentIds.map((id) => ({
          studentId: id, classId: toClassId, sectionId: toSectionId,
          sessionId: activeSession.id, termId: activeTerm.id, status: "enrolled",
        })),
      });

      const createdTransfers = await tx.studentTransfer.createMany({
        data: studentIds.map((id) => ({
          studentId: id, fromSchoolId, toSchoolId, toClassId, toSectionId,
          transferReason: transferReason || undefined, transferDate: new Date(),
        })),
      });
      return createdTransfers.count;
    });

    logger.info({ transferredCount: transferResultCount, fromSchoolId, toSchoolId, byUser: transferredByUserId }, "Students transferred successfully.");
    res.status(200).json({
      success: true,
      message: `${transferResultCount} student(s) transferred successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves student transfer records related to a specific school.
 * @route GET /api/students/:schoolId/transfer
 */
export const getTransferStudentsBySchool = async (
  req: Request<
    { schoolId: string }, {}, {}, { fromSchoolId?: string; toSchoolId?: string }
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const { schoolId: pathSchoolId } = req.params;
    const { fromSchoolId, toSchoolId } = req.query;

    if (!pathSchoolId || pathSchoolId.trim() === "") {
      return handleError(res, "A valid School ID (context) is required in the path parameters.", 400);
    }

    const filters: Prisma.StudentTransferWhereInput = {
      OR: [ { fromSchoolId: pathSchoolId }, { toSchoolId: pathSchoolId } ],
    };

    if (fromSchoolId && typeof fromSchoolId === 'string') {
        filters.AND = [...(filters.AND || []), { fromSchoolId }];
    }
    if (toSchoolId && typeof toSchoolId === 'string') {
        filters.AND = [...(filters.AND || []), { toSchoolId }];
    }

    const transfers = await prisma.studentTransfer.findMany({
      where: filters,
      include: {
          student: {select: {name: true, admission_number: true}},
          fromSchool: {select: {name: true}}, toSchool: {select: {name: true}},
          class: {select: {label: true}}, section: {select: {label: true}},
      },
      orderBy: { createdAt: "desc" },
    });
    logger.info({ pathSchoolId, filters, resultCount: transfers.length }, "Fetched student transfer records.");

    res.status(200).json({
      success: true, message: "Transfer students fetched successfully.",
      data: { transfers, total: transfers.length },
    });
  } catch (error) {
    next(error);
  }
};
