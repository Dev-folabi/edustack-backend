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
        "User ID not found on request. Authorization middleware may not have run.",
        500
      );
    }
    const { id: schoolId } = req.params;

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
      data: req.body,
    });
    logger.info(
      { schoolId, updatedBy: userId, updatedFields: Object.keys(req.body) },
      "School updated successfully."
    );

    if (req.body.adminId) {
      if (req.body.adminId !== userId) {
        const adminUserExists = await prisma.user.findUnique({
          where: { id: req.body.adminId },
          select: { id: true },
        });
        if (adminUserExists) {
          await prisma.userSchool.create({
            data: { userId: req.body.adminId, schoolId, role: "admin" },
          });
          logger.info(
            { schoolId, adminIdLinked: req.body.adminId },
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
