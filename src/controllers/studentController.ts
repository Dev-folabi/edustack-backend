import { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
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
import { Prisma } from ".prisma/client";
import logger from "../utils/logger";
import { paginateResults } from "../function/pagination";

/**
 * Retrieves a list of students for a given school.
 * Supports filtering by classId, student name, admission number, and active status.
 * @route GET /api/students/:schoolId/all (example, actual route in studentRoutes)
 */

export const getStudentsBySchool = async (
  req: Request<
    { schoolId: string },
    {},
    {},
    {
      sectionId?: string;
      name?: string;
      admissionNumber?: string;
      active?: string;
      page?: string;
      limit?: string;
    }
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(parseInt(req.query?.page as string, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query?.limit as string, 10) || 10, 1);
    const { schoolId } = req.params;
    const { sectionId, name, admissionNumber, active } = req.query;

    if (
      !schoolId ||
      schoolId.trim() === "" ||
      schoolId.trim() === ":schoolId"
    ) {
      return handleError(res, "A valid School ID is required.", 400);
    }

    // Build filters
    const filters: Prisma.UserSchoolWhereInput = {
      schoolId,
      role: "student",
      user: {
        student: {
          ...(sectionId && {
            student_enrolled: {
              some: { sectionId, status: "enrolled" },
            },
          }),
          ...(name && { name: { contains: name, mode: "insensitive" } }),
          ...(admissionNumber && {
            admission_number: admissionNumber as string,
          }),
          ...(active !== undefined && { isActive: active === "true" }),
        },
      },
    };

    // Count total for pagination
    const totalRecords = await prisma.userSchool.count({ where: filters });

    // Fetch paginated students
    const students = await prisma.userSchool.findMany({
      where: filters,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        schoolId: true,
        school: { select: { name: true } },
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            student: {
              select: {
                id: true,
                userId: true,
                admission_number: true,
                name: true,
                gender: true,
                dob: true,
                phone: true,
                address: true,
                admission_date: true,
                religion: true,
                blood_group: true,
                father_name: true,
                mother_name: true,
                father_occupation: true,
                mother_occupation: true,
                isActive: true,
                city: true,
                state: true,
                country: true,
                route_vehicle_id: true,
                room_id: true,
                added_by: true,
                photo_url: true,
                isStudent: true,
                parent: true,
                student_enrolled: {
                  where: { status: "enrolled" },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: {
                    class: { select: { name: true } },
                    section: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Map to clean response
    const data = students.map((s) => {
      const student = s.user?.student;
      const enrollment = student?.student_enrolled?.[0];
      return {
        studentId: student?.id,
        name: student?.name,
        admissionNumber: student?.admission_number,
        email: s.user?.email,
        username: s.user?.username,
        gender: student?.gender,
        dob: student?.dob,
        phone: student?.phone,
        address: student?.address,
        admission_date: student?.admission_date,
        religion: student?.religion,
        bloodGroup: student?.blood_group,
        fatherName: student?.father_name,
        motherName: student?.mother_name,
        fatherOccupation: student?.father_occupation,
        motherOccupation: student?.mother_occupation,
        isActive: student?.isActive,
        city: student?.city,
        state: student?.state,
        country: student?.country,
        routeVehicleId: student?.route_vehicle_id,
        roomId: student?.room_id,
        addedBy: student?.added_by,
        isStudent: student?.isStudent,
        parent: {
          id: student?.parent?.id,
          name: student?.parent?.name,
          email: student?.parent?.email,
          phone: student?.parent?.phone,
        },
        photoUrl: student?.photo_url,
        schoolId: s.schoolId,
        schoolName: s.school.name,
        currentClass: enrollment?.class?.name || null,
        currentSection: enrollment?.section?.name || null,
      };
    });

    res.status(200).json({
      success: true,
      message: "Students fetched successfully.",
      data: paginateResults(data, page, limit, totalRecords),
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
          where: { status: "enrolled" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            class: { select: { name: true } },
            section: { select: { name: true } },
            session: { select: { name: true } },
          },
        },
      },
    });

    if (!student) {
      logger.warn({ studentId }, "Student not found for getStudentDetails.");
      return handleError(res, "Student not found.", 404);
    }

    const currentEnrollment = student.student_enrolled[0];
    const enrollmentDetails = currentEnrollment
      ? {
          class: currentEnrollment.class.name,
          section: currentEnrollment.section.name,
          session: currentEnrollment.session.name,
        }
      : {};

    const data = {
      ..._.omit(student, [
        "student_enrolled",
        "user",
        "parent",
        "userId",
        "parentId",
      ]),
      email: student.user?.email,
      username: student.user?.username,
      parentDetails: student.parent,
      enrollment: enrollmentDetails,
    };
    logger.info({ studentId }, "Student details fetched successfully.");
    res.status(200).json({
      success: true,
      message: "Student details fetched successfully.",
      data,
    });
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
  promoteSessionId: string,
  promoteTermId: string,
  studentIdsForFirstCheck: string[],
  res: Response
) => {
  const fromClass = await findClassWithSections(fromClassId, res);
  if (!fromClass)
    return {
      success: false,
      error: { message: "Originating class not found.", status: 404 },
    };

  const toClass = await findClassWithSections(toClassId, res);

  if (!toClass)
    return {
      success: false,
      error: { message: "Destination class not found.", status: 404 },
    };

  const sectionInfo = toClass.sections.find(
    (section) => section.id === sectionId
  );
  if (!sectionInfo)
    return {
      success: false,
      error: {
        message: "Section not found in the destination class.",
        status: 404,
      },
    };

  if (fromClass.schoolId !== toClass.schoolId) {
    logger.warn(
      { fromClassSchool: fromClass.schoolId, toClassSchool: toClass.schoolId },
      "Cross-school promotion attempt denied."
    );
    return {
      success: false,
      error: {
        message: "Destination class must be in the same school.",
        status: 400,
      },
    };
  }

  const promoteSession = await prisma.session.findUnique({
    where: {
      id: promoteSessionId,
    },
    include: {
      terms: true,
    },
  });

  if (!promoteSession)
    return {
      success: false,
      error: {
        message:
          "No session found for promotion. Please ensure a session is provided.",
        status: 400,
      },
    };

  const promoteTerm = promoteSession.terms.find(
    (term) => term.id === promoteTermId
  );
  if (!promoteTerm)
    return {
      success: false,
      error: {
        message:
          "No term found for promotion. Please ensure a term is provided.",
        status: 400,
      },
    };

  const studentsToPromote = await prisma.student.findMany({
    where: { id: { in: studentIdsForFirstCheck } },
  });
  if (studentsToPromote.length !== studentIdsForFirstCheck.length) {
    const foundIds = studentsToPromote.map((s) => s.id);
    const notFoundIds = studentIdsForFirstCheck.filter(
      (id) => !foundIds.includes(id)
    );
    logger.warn(
      { notFoundStudentIds: notFoundIds },
      "One or more students to promote were not found during prerequisite check."
    );
    return {
      success: false,
      error: {
        message: `One or more students to promote were not found.`,
        status: 404,
      },
    };
  }

  const firstStudentForCheck = studentsToPromote[0];
  const currentEnrollmentForSessionCheck =
    await prisma.studentEnrollment.findFirst({
      where: {
        studentId: firstStudentForCheck.id,
        classId: fromClassId,
        status: "enrolled",
      },
      include: { session: true },
      orderBy: { createdAt: "desc" },
    });

  if (currentEnrollmentForSessionCheck?.session) {
    const currentSessionStartDateStr =
      currentEnrollmentForSessionCheck.session.start_date?.toISOString();
    const promoteSessionStartDateStr = promoteSession.start_date?.toISOString();

    if (currentSessionStartDateStr && promoteSessionStartDateStr) {
      const currentSessionStartDate = new Date(currentSessionStartDateStr);
      const promoteSessionStartDate = new Date(promoteSessionStartDateStr);

      if (
        isNaN(currentSessionStartDate.getTime()) ||
        isNaN(promoteSessionStartDate.getTime())
      ) {
        logger.error(
          {
            promoteSessionStartDate: promoteSessionStartDateStr,
            currentStudentSessionStart: currentSessionStartDateStr,
            studentId: firstStudentForCheck.id,
          },
          "Invalid date format during promotion session check."
        );
        return {
          success: false,
          error: {
            message: "Invalid session date format. Cannot proceed.",
            status: 500,
          },
        };
      }
      if (
        promoteSessionStartDate.getTime() <= currentSessionStartDate.getTime()
      ) {
        logger.warn(
          {
            promoteSessionStart: promoteSession.start_date,
            currentStudentSessionStart:
              currentEnrollmentForSessionCheck.session.start_date,
            studentId: firstStudentForCheck.id,
          },
          "Promotion session date conflict."
        );
        return {
          success: false,
          error: {
            message:
              "Promotion must be to a new session that is chronologically after the student's current session.",
            status: 400,
          },
        };
      }
    } else {
      logger.warn(
        {
          studentId: firstStudentForCheck.id,
          fromClassId,
          activeSessionId: promoteSession.id,
        },
        "Session start dates missing for promotion validation. Proceeding with caution."
      );
    }
  }
  return {
    success: true,
    data: {
      fromClass,
      toClass,
      sectionInfo,
      promoteSession,
      promoteTerm,
      studentsToPromote,
    },
  };
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
    const {
      studentIds: studentIds,
      fromClassId,
      toClassId,
      sectionId,
      promoteSessionId,
      promoteTermId,
      isGraduate,
    } = req.body;

    const promotedByUserId = getIdFromToken(req);
    if (!promotedByUserId) {
      logger.error(
        "Failed to get user ID from token for promotion. Unauthorized."
      );
      handleError(
        res,
        "User authentication failed, cannot perform promotion.",
        401
      );
      return;
    }
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      logger.warn(
        { providedStudentId: studentIds },
        "Invalid studentId(s) for promotion: must be non-empty array."
      );
      handleError(
        res,
        "studentId must be a non-empty array of student IDs.",
        400
      );
      return;
    }

    if (isGraduate) {
      const enrolledStudents = await prisma.studentEnrollment.findMany({
        where: {
          studentId: { in: studentIds },
          classId: fromClassId,
          sectionId: sectionId,
          status: "enrolled",
        },
        include: {
          student: true,
        },
      });

      if (enrolledStudents.length !== studentIds.length) {
        logger.warn(
          {
            providedIds: studentIds,
            foundEnrollments: enrolledStudents.length,
          },
          "Not all students are currently enrolled for graduation"
        );
        handleError(
          res,
          "All students must be currently enrolled to graduate",
          400
        );
        return;
      }

      // Update enrollment status to graduated
      await prisma.studentEnrollment.updateMany({
        where: {
          studentId: { in: studentIds },
          classId: fromClassId,
          sectionId: sectionId,
          status: "enrolled",
        },
        data: {
          status: "graduated",
        },
      });

      logger.info(
        { graduatedStudentIds: studentIds },
        "Students marked as graduated successfully"
      );

      res.status(200).json({
        success: true,
        message: "Students graduated successfully",
      });
      return;
    }

    const prereqResult = await _validatePromotionPrerequisites(
      fromClassId,
      toClassId,
      sectionId,
      promoteSessionId,
      promoteTermId,
      studentIds,
      res
    );

    if (!prereqResult.success) {
      return handleError(
        res,
        prereqResult.error!.message,
        prereqResult.error!.status
      );
    }
    const { promoteSession, promoteTerm } = prereqResult.data!;

    await prisma.$transaction(async (tx) => {
      await tx.studentEnrollment.updateMany({
        where: {
          studentId: { in: studentIds },
          classId: fromClassId,
          status: "enrolled",
        },
        data: { status: "promoted" },
      });
      await tx.promotionHistory.createMany({
        data: studentIds.map((id) => ({
          studentId: id,
          fromClassId,
          toClassId,
          sessionId: promoteSession.id,
          termId: promoteTerm.id,
          promotedBy: promotedByUserId,
        })),
      });
      await tx.studentEnrollment.createMany({
        data: studentIds.map((id) => ({
          studentId: id,
          classId: toClassId,
          sectionId,
          sessionId: promoteSession.id,
          termId: promoteTerm.id,
          status: "enrolled",
        })),
      });
    });
    logger.info(
      {
        promotedStudentIds: studentIds,
        toClassId,
        sectionId,
        byUser: promotedByUserId,
        sessionId: promoteSession.id,
        termId: promoteTerm.id,
      },
      "Students promoted successfully."
    );
    res
      .status(200)
      .json({ success: true, message: "Students promoted successfully." });
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
  toSectionId: string,
  res: Response
) => {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    logger.warn(
      { providedStudentIds: studentIds },
      "Invalid studentId(s) for transfer: must be non-empty array."
    );
    return {
      success: false,
      error: {
        message: "Student ID(s) are required and must be a non-empty array.",
        status: 400,
      },
    };
  }
  if (!toSchoolId || !toClassId || !toSectionId) {
    return {
      success: false,
      error: {
        message: "Target school, class, and section are required.",
        status: 400,
      },
    };
  }

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: { user: { select: { username: true, id: true } } },
  });
  if (students.length !== studentIds.length) {
    const foundIds = students.map((s) => s.id);
    const notFoundIds = studentIds.filter((id) => !foundIds.includes(id));
    logger.warn(
      { notFoundStudentIds: notFoundIds },
      "One or more students for transfer not found."
    );
    return {
      success: false,
      error: { message: `One or more students not found.`, status: 404 },
    };
  }

  let commonFromSchoolId: string | null = null;
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const currentEnrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, status: "enrolled" },
      include: { class: { select: { schoolId: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (!currentEnrollment?.class?.schoolId) {
      const studentDisplayName =
        student.name || student.user?.username || student.id;
      logger.warn(
        { studentId: student.id, studentName: studentDisplayName },
        `Could not determine current school for student transfer.`
      );
      return {
        success: false,
        error: {
          message: `Could not determine current school for student ${studentDisplayName}. Ensure student is actively enrolled.`,
          status: 400,
        },
      };
    }
    if (i === 0) commonFromSchoolId = currentEnrollment.class.schoolId;
    else if (currentEnrollment.class.schoolId !== commonFromSchoolId) {
      const studentDisplayName =
        student.name || student.user?.username || student.id;
      logger.warn(
        {
          studentId: student.id,
          studentName: studentDisplayName,
          expectedSchoolId: commonFromSchoolId,
          actualSchoolId: currentEnrollment.class.schoolId,
        },
        "Inconsistent origin schools in batch transfer."
      );
      return {
        success: false,
        error: {
          message: "All students must belong to the same origin school.",
          status: 400,
        },
      };
    }
  }
  if (!commonFromSchoolId) {
    logger.error(
      { studentIdsProvided: studentIds },
      "Failed to determine common origin school ID for transfer."
    );
    return {
      success: false,
      error: {
        message: "Could not determine a common origin school for the transfer.",
        status: 400,
      },
    };
  }
  const fromSchoolId = commonFromSchoolId;

  if (fromSchoolId === toSchoolId) {
    logger.warn(
      { studentIds, schoolId: fromSchoolId },
      "Attempt to transfer students within the same school."
    );
    return {
      success: false,
      error: {
        message: "Cannot transfer students within the same school.",
        status: 400,
      },
    };
  }

  const [fromSchool, toSchool, targetClass, targetSection] = await Promise.all([
    prisma.school.findUnique({ where: { id: fromSchoolId, isActive: true } }),
    prisma.school.findUnique({ where: { id: toSchoolId, isActive: true } }),
    prisma.classes.findUnique({
      where: { id: toClassId, schoolId: toSchoolId },
    }),
    prisma.class_Section.findUnique({
      where: { id: toSectionId, classId: toClassId },
    }),
  ]);

  if (!fromSchool)
    return {
      success: false,
      error: { message: "Origin school not found or inactive.", status: 404 },
    };
  if (!toSchool)
    return {
      success: false,
      error: { message: "Target school not found or inactive.", status: 404 },
    };
  if (!targetClass)
    return {
      success: false,
      error: {
        message:
          "Target class not found or does not belong to the target school.",
        status: 404,
      },
    };
  if (!targetSection)
    return {
      success: false,
      error: {
        message:
          "Target section not found or does not belong to the target class.",
        status: 404,
      },
    };

  const activeSession = await findActiveSession(res, toSchoolId);

  if (!activeSession)
    return {
      success: false,
      error: { message: "No active session found for transfer.", status: 400 },
    };
  const activeTerm = activeSession.terms.find((term) => term.isActive);
  if (!activeTerm)
    return {
      success: false,
      error: {
        message: "No active term found in session for transfer.",
        status: 400,
      },
    };

  return {
    success: true,
    data: {
      students,
      commonFromSchoolId: fromSchoolId,
      fromSchool,
      toSchool,
      targetClass,
      targetSection,
      activeSession,
      activeTerm,
    },
  };
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
    const {
      studentIds: studentIds,
      toSchoolId,
      toClassId,
      toSectionId,
      transferReason,
    } = req.body;
    const transferredByUserId = getIdFromToken(req);
    if (!transferredByUserId) {
      logger.error(
        "Failed to get user ID from token for transfer. Unauthorized."
      );
      return handleError(
        res,
        "User authentication failed, cannot perform transfer.",
        401
      );
    }

    const prereqResult = await _validateTransferPrerequisitesAndGetContext(
      studentIds,
      toSchoolId,
      toClassId,
      toSectionId,
      res
    );

    if (!prereqResult.success) {
      return handleError(
        res,
        prereqResult.error!.message,
        prereqResult.error!.status
      );
    }
    const {
      students,
      commonFromSchoolId: fromSchoolId,
      activeSession,
      activeTerm,
    } = prereqResult.data!;

    const transferResultCount = await prisma.$transaction(async (tx) => {
      await tx.studentEnrollment.updateMany({
        where: {
          studentId: { in: studentIds },
          status: "enrolled",
          class: { schoolId: fromSchoolId },
        },
        data: { status: "transferred" },
      });

      const studentUserIds = students.map((s) => s.userId);
      await tx.userSchool.updateMany({
        where: {
          userId: { in: studentUserIds },
          schoolId: fromSchoolId,
          role: "student",
        },
        data: { schoolId: toSchoolId },
      });

      // Update students with new schoolId and generate new admission numbers
      for (const studentId of studentIds) {
        // Find the last student for the target school to determine the next admission number
        const lastStudent = await tx.student.findFirst({
          where: { schoolId: toSchoolId },
          orderBy: { createdAt: "desc" },
          select: { admission_number: true },
        });

        let nextAdmissionNumber = 1;
        if (lastStudent && lastStudent.admission_number) {
          const lastNum = parseInt(lastStudent.admission_number, 10);
          if (!isNaN(lastNum)) {
            nextAdmissionNumber = lastNum + 1;
          }
        }
        const admissionNumberString = nextAdmissionNumber
          .toString()
          .padStart(6, "0");

        await tx.student.update({
          where: { id: studentId },
          data: {
            schoolId: toSchoolId,
            admission_number: admissionNumberString,
          },
        });
      }

      await tx.studentEnrollment.createMany({
        data: studentIds.map((id) => ({
          studentId: id,
          classId: toClassId,
          sectionId: toSectionId,
          sessionId: activeSession.id,
          termId: activeTerm.id,
          status: "enrolled",
        })),
      });

      const createdTransfers = await tx.studentTransfer.createMany({
        data: studentIds.map((id) => ({
          studentId: id,
          fromSchoolId,
          toSchoolId,
          toClassId,
          toSectionId,
          transferReason: transferReason || undefined,
          transferDate: new Date(),
        })),
      });
      return createdTransfers.count;
    });

    logger.info(
      {
        transferredCount: transferResultCount,
        fromSchoolId,
        toSchoolId,
        byUser: transferredByUserId,
      },
      "Students transferred successfully."
    );
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
    { schoolId: string },
    {},
    {},
    { fromSchoolId?: string; toSchoolId?: string }
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const { schoolId: pathSchoolId } = req.params;
    const { fromSchoolId, toSchoolId } = req.query;

    if (!pathSchoolId || pathSchoolId.trim() === "") {
      return handleError(
        res,
        "A valid School ID (context) is required in the path parameters.",
        400
      );
    }

    const filters: Prisma.StudentTransferWhereInput = {
      OR: [{ fromSchoolId: pathSchoolId }, { toSchoolId: pathSchoolId }],
    };

    if (fromSchoolId && typeof fromSchoolId === "string") {
      filters.AND = filters.AND || [];
      (filters.AND as Prisma.StudentTransferWhereInput[]).push({
        fromSchoolId,
      });
    }
    if (toSchoolId && typeof toSchoolId === "string") {
      filters.AND = filters.AND || [];
      (filters.AND as Prisma.StudentTransferWhereInput[]).push({ toSchoolId });
    }

    const transfers = await prisma.studentTransfer.findMany({
      where: filters,
      include: {
        student: { select: { name: true, admission_number: true } },
        fromSchool: { select: { name: true } },
        toSchool: { select: { name: true } },
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    logger.info(
      { pathSchoolId, filters, resultCount: transfers.length },
      "Fetched student transfer records."
    );

    res.status(200).json({
      success: true,
      message: "Transfer students fetched successfully.",
      data: { transfers, total: transfers.length },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates student information
 * @route PUT /api/students/:studentId
 */
export const updateStudent = async (
  req: Request<{ studentId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;

    const existingStudent = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!existingStudent) {
      return handleError(res, "Student not found", 404);
    }

    const { email, password, username, ...studentData } = req.body;

    const userUpdateData: any = {};
    const studentUpdateData: any = {};

    if (username !== undefined && username !== existingStudent.user.username) {
      const existingUser = await prisma.user.findUnique({
        where: { username },
      });
      if (existingUser) {
        return handleError(res, "Username already exists", 400);
      }
    }

    Object.assign(userUpdateData, {
      ...(email !== undefined && { email }),
      ...(username !== undefined && { username }),
      ...(password !== undefined && {
        password: await bcrypt.hash(password, 10),
      }),
    });

    Object.keys(studentData).forEach((key) => {
      if (studentData[key] !== undefined) {
        studentUpdateData[key] = studentData[key];
      }
    });

    if (studentUpdateData.dob) {
      studentUpdateData.dob = new Date(studentUpdateData.dob);
    }
    if (studentUpdateData.admission_date) {
      studentUpdateData.admission_date = new Date(
        studentUpdateData.admission_date
      );
    }

    const { classId, sectionId, ...studentDataToUpdate } = studentUpdateData;

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: existingStudent.userId },
          data: userUpdateData,
        });
      }

      if (Object.keys(studentDataToUpdate).length > 0) {
        await tx.student.update({
          where: { id: studentId },
          data: studentDataToUpdate,
        });
      }

      if (classId || sectionId) {
        const studentEnrollment = await tx.studentEnrollment.findFirst({
          where: { studentId: studentId },
        });

        if (studentEnrollment) {
          await tx.studentEnrollment.update({
            where: { id: studentEnrollment.id },
            data: {
              classId: classId ?? undefined,
              sectionId: sectionId ?? undefined,
            },
          });
        }
      }

      return tx.student.findUnique({
        where: { id: studentId },
        include: { user: true },
      });
    });

    logger.info({ studentId }, "Student updated successfully");

    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: _.omit(updated?.user, ["password"]),
    });
  } catch (error) {
    logger.error({ err: error, body: req.body }, "Error updating student");
    next(error);
  }
};
