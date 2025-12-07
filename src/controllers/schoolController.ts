import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { ISchoolRequest } from "../types/requests";
import { getIdFromToken } from "../function/token";
import { validateUserSchool } from "../function/schoolFunctions";
import { handleError } from "../error/errorHandler";
import { paginateResults } from "../function/pagination";
import logger from "../utils/logger";
import { MAX_SCHOOL_CREATION_LIMIT } from "../config/constants";
import { Prisma } from "@prisma/client";
import { SchoolDashboardQuery } from "../types/requests/schoolDashboard";

/**
 * Creates a new school.
 * Requires the user to be a super_admin or an admin.
 * A school limit is enforced by `MAX_SCHOOL_CREATION_LIMIT`.
 * Optionally links an additional admin to the school if `adminId` is provided.
 * @route POST /api/school
 */
export const createSchool = async (
  req: Request<{}, {}, ISchoolRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getIdFromToken(req);
    if (!userId) {
      return handleError(
        res,
        "User ID could not be determined from token. Authorization missing or token invalid.",
        401
      );
    }

    const { name, email, phone, address, adminId, isActive } = req.body;

    const existingSchool = await prisma.school.findFirst({ where: { name } });
    if (existingSchool) {
      logger.warn(
        { schoolName: name, requestedBy: userId },
        "Attempt to create school that already exists."
      );
      return handleError(
        res,
        `School with name "${name}" already exists.`,
        400
      );
    }

    const schoolList = await prisma.school.findMany({ select: { id: true } });
    if (schoolList.length >= MAX_SCHOOL_CREATION_LIMIT) {
      logger.warn(
        {
          currentSchoolCount: schoolList.length,
          limit: MAX_SCHOOL_CREATION_LIMIT,
          requestedBy: userId,
        },
        "School creation limit reached."
      );
      return handleError(
        res,
        `Maximum number of schools (${MAX_SCHOOL_CREATION_LIMIT}) has been reached. Cannot create more.`,
        400
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userSchools: { select: { role: true } } },
    });

    if (!user) {
      logger.error(
        { userIdFromToken: userId },
        "User not found for a valid token during school creation. Data integrity issue suspected."
      );
      return handleError(res, "Authenticated user not found.", 404);
    }

    const isPlatformSuperAdmin = user.isSuperAdmin;
    const isSchoolAdmin = user.userSchools.some((us) => us.role === "admin");

    if (!isPlatformSuperAdmin && !isSchoolAdmin) {
      logger.warn(
        {
          userId,
          userRoles: user.userSchools.map((us) => us.role),
          isSuperAdmin: user.isSuperAdmin,
        },
        "Unauthorized attempt to create school."
      );
      return handleError(
        res,
        "You are not authorized to create new schools.",
        403
      );
    }

    const school = await prisma.school.create({
      data: {
        name,
        email,
        phone,
        address,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
    logger.info(
      { schoolId: school.id, createdBy: userId, schoolName: school.name },
      "School created successfully."
    );

    await prisma.userSchool.create({
      data: {
        userId,
        schoolId: school.id,
        role: user.isSuperAdmin ? "super_admin" : "admin",
      },
    });

    if (adminId) {
      if (adminId !== userId) {
        const adminUserExists = await prisma.user.findUnique({
          where: { id: adminId },
          select: { id: true },
        });
        if (adminUserExists) {
          await prisma.userSchool.create({
            data: { userId: adminId, schoolId: school.id, role: "admin" },
          });
          logger.info(
            { schoolId: school.id, adminIdLinked: adminId },
            "Additional admin linked to new school."
          );
        } else {
          logger.warn(
            { schoolId: school.id, adminIdToLink: adminId, createdBy: userId },
            "Specified additional adminId for new school does not exist."
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "School created successfully.",
      data: school,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Retrieves schools associated with the authenticated user.
 * Results are paginated.
 * @route GET /api/school
 */
export const getUserSchools = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getIdFromToken(req);
    if (!userId) {
      return handleError(
        res,
        "User ID could not be determined from token. Authorization missing or token invalid.",
        401
      );
    }

    const page = parseInt(req.query?.page as string, 10);
    const limit = parseInt(req.query?.limit as string, 10);

    const schools = await prisma.school.findMany({
      where: { userSchools: { some: { userId } } },
      orderBy: { name: "asc" },
    });

    const totalRecords = await prisma.school.count({
      where: { userSchools: { some: { userId } } },
    });

    if (!schools.length && page === 1) {
      // Only show 404 if it's the first page and no records
      logger.info({ userId }, "No schools found for user.");
      return handleError(res, "No schools found for this user.", 404);
    }
    res.status(200).json({
      success: true,
      message: "Schools fetched successfully.",
      data: paginateResults(schools, page, limit, totalRecords),
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Retrieves all schools in the system.
 * @route GET /api/school/all
 */
export const getAllSchools = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, isActive, page, limit } = req.query;
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);

    const whereClause: Prisma.SchoolWhereInput = {
      name: name
        ? { contains: name.toString(), mode: "insensitive" }
        : undefined,
      isActive: isActive ? isActive === "true" : undefined,
    };

    const schools = await prisma.school.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        userSchools: {
          where: { role: "admin" },
          select: {
            user: {
              select: {
                id: true,
                email: true,
                staff: { select: { id: true, name: true } },
                student: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const totalRecords = await prisma.school.count({ where: whereClause });

    if (!schools.length && pageNumber === 1 && totalRecords === 0) {
      logger.info(
        { query: req.query },
        "No schools found matching criteria for getAllSchools."
      );
    }
    res.status(200).json({
      success: true,
      message: "Schools fetched successfully.",
      data: paginateResults(schools, pageNumber, limitNumber, totalRecords),
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Retrieves a specific school by its ID.
 * @route GET /api/school/:id
 */
export const getSchool = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getIdFromToken(req);
    if (!userId) {
      return handleError(
        res,
        "User ID could not be determined from token. Authorization missing or token invalid.",
        401
      );
    }
    const { id: schoolId } = req.params;

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      logger.warn(
        { schoolId, requestedBy: userId },
        "School record not found in getSchool."
      );
      return handleError(res, "School not found.", 404);
    }

    res.status(200).json({
      success: true,
      message: "School fetched successfully.",
      data: school,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Updates an existing school's details.
 * @route PUT /api/school/:id
 */
export const updateSchool = async (
  req: Request<{ id: string }, {}, Partial<ISchoolRequest>>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user;
    if (!userId) {
      return handleError(
        res,
        "Unauthorized: User ID not found on request.",
        500
      );
    }
    const { id: schoolId } = req.params;
    const { adminId, ...rest } = req.body;

    if (req.body.name) {
      const existingSchoolWithSameName = await prisma.school.findFirst({
        where: { name: req.body.name, NOT: { id: schoolId } },
      });
      if (existingSchoolWithSameName) {
        logger.warn(
          { attemptedName: req.body.name, schoolId, updatedBy: userId },
          "Attempt to update school name to an already existing name."
        );
        return handleError(
          res,
          "Another school with this name already exists.",
          400
        );
      }
    }

    const schoolToUpdate = await prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!schoolToUpdate) {
      logger.warn(
        { schoolId, updatedBy: userId },
        "Attempt to update non-existent school."
      );
      return handleError(res, "School not found for update.", 404);
    }

    const updatedSchool = await prisma.school.update({
      where: { id: schoolId },
      data: rest,
    });
    logger.info(
      { schoolId, updatedBy: userId, updatedFields: Object.keys(req.body) },
      "School updated successfully."
    );

    if (adminId) {
      if (adminId !== userId) {
        const adminUserExists = await prisma.user.findUnique({
          where: { id: adminId },
          select: { id: true },
        });
        if (adminUserExists) {
          await prisma.userSchool.create({
            data: { userId: adminId, schoolId, role: "admin" },
          });
          logger.info(
            { schoolId, adminIdLinked: adminId },
            "Additional admin linked to new school."
          );
        } else {
          logger.warn(
            {
              schoolId: schoolId,
              adminIdToLink: req.body.adminId,
              createdBy: userId,
            },
            "Specified additional adminId for new school does not exist."
          );
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "School updated successfully.",
      data: updatedSchool,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Deletes a school.
 * @route DELETE /api/school/:id
 */
export const deleteSchool = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user;
    if (!userId) {
      return handleError(
        res,
        "User ID not found on request for deleteSchool. Authorization may have failed.",
        500
      );
    }
    const { id: schoolId } = req.params;

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      logger.warn(
        { schoolId, deletedBy: userId },
        "Attempt to delete non-existent school."
      );
      return handleError(res, "School not found.", 404);
    }

    const associatedClassesCount = await prisma.classes.count({
      where: { schoolId: schoolId },
    });
    if (associatedClassesCount > 0) {
      logger.warn(
        { schoolId, deletedBy: userId, classCount: associatedClassesCount },
        "Attempt to delete school with associated classes."
      );
      return handleError(
        res,
        `Cannot delete school. It has ${associatedClassesCount} associated class(es). Please delete or reassign these classes first.`,
        400
      );
    }

    const associatedTransfersCount = await prisma.studentTransfer.count({
      where: { OR: [{ fromSchoolId: schoolId }, { toSchoolId: schoolId }] },
    });
    if (associatedTransfersCount > 0) {
      logger.warn(
        {
          schoolId,
          deletedBy: userId,
          transferCount: associatedTransfersCount,
        },
        "Attempt to delete school referenced in student transfers."
      );
      return handleError(
        res,
        `Cannot delete school. It is referenced in ${associatedTransfersCount} student transfer record(s). Please resolve these references first.`,
        400
      );
    }

    await prisma.school.delete({ where: { id: schoolId } });
    logger.info(
      { schoolId, deletedBy: userId },
      "School deleted successfully after passing pre-delete checks."
    );

    res.status(200).json({
      success: true,
      message: "School deleted successfully.",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Retrieves comprehensive dashboard data for a school.
 * @route GET /api/school/dashboard/:schoolId
 */
export const getSchoolDashboard = async (
  req: Request<{ schoolId: string }, {}, {}, SchoolDashboardQuery>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { schoolId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify school exists
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return handleError(res, "School not found.", 404);
    }

    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Get current date for attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parallel data fetching
    const [
      totalStudents,
      activeStudents,
      totalStaff,
      activeStaff,
      totalClasses,
      totalSections,
      currentSession,
      currentTerm,
      studentsByGender,
      studentsByClass,
      staffByRole,
      staffByGender,
      recentAdmissions,
      invoiceStats,
      paymentStats,
      expenseStats,
      todayAttendance,
      examStats,
    ] = await Promise.all([
      // Student metrics
      prisma.student.count({ where: { schoolId } }),
      prisma.student.count({ where: { schoolId, isActive: true } }),

      // Staff metrics
      prisma.userSchool.count({
        where: { schoolId, user: { staff: { isNot: null } } },
      }),
      prisma.userSchool.count({
        where: { schoolId, user: { staff: { isActive: true } } },
      }),

      // Classes and sections
      prisma.classes.count({ where: { schoolId } }),
      prisma.class_Section.count({
        where: { classes: { schoolId } },
      }),

      // Current session
      prisma.session.findFirst({
        where: { schoolId, isActive: true },
        select: {
          id: true,
          name: true,
          start_date: true,
          end_date: true,
          isActive: true,
        },
      }),

      // Current term
      prisma.term.findFirst({
        where: {
          session: { schoolId, isActive: true },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          start_date: true,
          end_date: true,
          isActive: true,
        },
      }),

      // Students by gender
      prisma.student.groupBy({
        by: ["gender"],
        where: { schoolId, isActive: true },
        _count: true,
      }),

      // Students by class
      prisma.classes.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          sections: {
            select: {
              id: true,
              name: true,
              student_enrolled: {
                where: { status: "enrolled" },
                select: { studentId: true },
              },
            },
          },
        },
      }),

      // Staff by role
      prisma.userSchool.groupBy({
        by: ["role"],
        where: { schoolId },
        _count: true,
      }),

      // Staff by gender
      prisma.staff.groupBy({
        by: ["gender"],
        where: {
          user: { userSchools: { some: { schoolId } } },
          isActive: true,
        },
        _count: true,
      }),

      // Recent admissions
      prisma.student.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          admission_number: true,
          admission_date: true,
          gender: true,
          photo_url: true,
          student_enrolled: {
            where: { status: "enrolled" },
            take: 1,
            select: {
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { admission_date: "desc" },
        take: 10,
      }),

      // Invoice statistics
      prisma.studentInvoice.aggregate({
        where: {
          invoice: {
            schoolId,
            ...(Object.keys(dateFilter).length > 0 && {
              createdAt: dateFilter,
            }),
          },
        },
        _sum: {
          totalAmount: true,
          amountPaid: true,
          amountDue: true,
        },
        _count: true,
      }),

      // Payment statistics
      prisma.payment.aggregate({
        where: {
          schoolId,
          status: "COMPLETED",
          ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
        },
        _sum: { amount: true },
      }),

      // Expense statistics
      prisma.expense.aggregate({
        where: {
          schoolId,
          ...(Object.keys(dateFilter).length > 0 && {
            expenseDate: dateFilter,
          }),
        },
        _sum: { amount: true },
      }),

      // Today's attendance
      prisma.attendance.groupBy({
        by: ["status"],
        where: {
          attendanceType: "STUDENT",
          date: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
          student: { schoolId },
        },
        _count: true,
      }),

      // Exam statistics
      prisma.exam.findMany({
        where: { schoolId },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          papers: {
            select: {
              isResultPublished: true,
            },
          },
        },
      }),
    ]);

    // Process students by class
    const classByData = studentsByClass.map((cls) => {
      const sections = cls.sections.map((section) => ({
        sectionId: section.id,
        sectionName: section.name,
        studentCount: section.student_enrolled.length,
      }));

      return {
        classId: cls.id,
        className: cls.name,
        studentCount: sections.reduce((sum, s) => sum + s.studentCount, 0),
        sections,
      };
    });

    // Process exam statistics
    const now = new Date();
    let upcomingExams = 0;
    let ongoingExams = 0;
    let completedExams = 0;
    let pendingResults = 0;

    examStats.forEach((exam) => {
      const examStart = new Date(exam.startDate);
      const examEnd = new Date(exam.endDate);

      if (now < examStart) {
        upcomingExams++;
      } else if (now >= examStart && now <= examEnd) {
        ongoingExams++;
      } else {
        completedExams++;
        // Check if results are pending
        const hasUnpublishedResults = exam.papers.some(
          (paper) => !paper.isResultPublished
        );
        if (hasUnpublishedResults) {
          pendingResults++;
        }
      }
    });

    // Calculate attendance metrics
    const todayPresent =
      todayAttendance.find((a) => a.status === "PRESENT")?._count || 0;
    const todayAbsent =
      todayAttendance.find((a) => a.status === "ABSENT")?._count || 0;
    const todayTotal = todayPresent + todayAbsent;
    const attendanceRate =
      todayTotal > 0 ? (todayPresent / todayTotal) * 100 : 0;

    // Calculate financial metrics
    const totalRevenue = paymentStats._sum.amount || 0;
    const totalExpenses = expenseStats._sum.amount || 0;
    const netIncome = totalRevenue - totalExpenses;
    const totalInvoiceAmount = invoiceStats._sum.totalAmount || 0;
    const totalAmountPaid = invoiceStats._sum.amountPaid || 0;
    const totalAmountDue = invoiceStats._sum.amountDue || 0;
    const collectionRate =
      totalInvoiceAmount > 0 ? (totalAmountPaid / totalInvoiceAmount) * 100 : 0;

    // Format response
    const dashboardData = {
      overview: {
        totalStudents,
        activeStudents,
        totalStaff,
        activeStaff,
        totalClasses,
        totalSections,
      },
      academicInfo: {
        currentSession: currentSession
          ? {
              id: currentSession.id,
              name: currentSession.name,
              start_date: currentSession.start_date.toISOString(),
              end_date: currentSession.end_date.toISOString(),
              isActive: currentSession.isActive,
            }
          : null,
        currentTerm: currentTerm
          ? {
              id: currentTerm.id,
              name: currentTerm.name,
              start_date: currentTerm.start_date.toISOString(),
              end_date: currentTerm.end_date.toISOString(),
              isActive: currentTerm.isActive,
            }
          : null,
      },
      financialSummary: {
        totalRevenue,
        totalExpenses,
        netIncome,
        totalInvoices: invoiceStats._count,
        totalInvoiceAmount,
        totalAmountPaid,
        totalAmountDue,
        collectionRate: Math.round(collectionRate * 100) / 100,
      },
      studentBreakdown: {
        byGender: studentsByGender.map((g) => ({
          gender: g.gender,
          count: g._count,
        })),
        byClass: classByData,
      },
      staffBreakdown: {
        byRole: staffByRole.map((r) => ({
          role: r.role,
          count: r._count,
        })),
        byGender: staffByGender
          .filter((g) => g.gender !== null)
          .map((g) => ({
            gender: g.gender!,
            count: g._count,
          })),
      },
      recentAdmissions: recentAdmissions.map((student) => ({
        id: student.id,
        name: student.name,
        admissionNumber: student.admission_number,
        admission_date: student.admission_date.toISOString(),
        gender: student.gender,
        class: student.student_enrolled[0]?.class || null,
        section: student.student_enrolled[0]?.section || null,
        photo_url: student.photo_url,
      })),
      upcomingEvents: [],
      examinations: {
        upcomingExams,
        ongoingExams,
        completedExams,
        pendingResults,
      },
      attendance: {
        todayPresent,
        todayAbsent,
        todayTotal,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        lastUpdated: new Date().toISOString(),
      },
    };

    logger.info({ schoolId }, "School dashboard data retrieved successfully.");

    res.status(200).json({
      success: true,
      message: "School dashboard data retrieved successfully",
      data: dashboardData,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching school dashboard:");
    next(error);
  }
};
