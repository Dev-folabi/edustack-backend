import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { ISchoolRequest } from "../types/requests";
import { getIdFromToken } from "../function/token";
import { validateUserSchool } from "../function/schoolFunctions";
import { handleError } from "../error/errorHandler";
import { paginateResults } from "../function/pagination";

// Create a new school
export const createSchool = async (
  req: Request<{}, {}, ISchoolRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getIdFromToken(req);
    const { name, email, phone, address, adminId, isActive } = req.body;

    // Check if the school already exists
    const existingSchool = await prisma.school.findFirst({ where: { name } });
    if (existingSchool) return handleError(res, "School already exists", 400);

    // Check user school limit
    const schoolList = await prisma.school.findMany();
    if (schoolList.length >= 3)
      return handleError(res, "School limit of 3 reached", 400);

    // Check if user is super admin or admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userSchools: true,
      },
    });

    if (!user) {
      return handleError(res, "User not found", 404);
    }

    const isAuthorized =
      user.isSuperAdmin || user.userSchools.some((us) => us.role === "admin");

    if (!isAuthorized) {
      return handleError(
        res,
        "Only super admin and admin can create schools",
        403
      );
    }

    // Create school
    const school = await prisma.school.create({
      data: { name, email, phone, address, isActive },
    });

    // Link school to user
    await prisma.userSchool.create({
      data: {
        userId,
        schoolId: school.id,
        role: user.isSuperAdmin ? "super_admin" : "admin",
      },
    });

    if (adminId) {
      await prisma.userSchool.create({
        data: {
          userId: adminId,
          schoolId: school.id,
          role: "admin",
        },
      });
    }

    res.status(201).json({
      success: true,
      message: "School created successfully",
      data: school,
    });
  } catch (error: any) {
    console.error("Error in createSchool:", error);
    next(error);
  }
};

// Get user schools
export const getUserSchools = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getIdFromToken(req);

    const schools = await prisma.school.findMany({
      where: {
        userSchools: { some: { userId } },
      },
    });

    if (!schools.length) {
      return handleError(res, "No schools found", 404);
    }
    res.status(200).json({
      success: true,
      message: "Schools fetched successfully",
      data: paginateResults(
        schools,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    console.error("Error in getUserSchools:", error);
    next(error);
  }
};

// Get All schools
export const getAllSchools = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return handleError(res, "Authorization header is missing", 401);

    const { name, isActive } = req.query;

    const schools = await prisma.school.findMany({
      where: {
        name: name ? { contains: name.toString() } : undefined,
        isActive: isActive ? isActive === "true" : undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!schools.length) {
      return handleError(res, "No schools found", 404);
    }
    res.status(200).json({
      success: true,
      message: "Schools fetched successfully",
      data: paginateResults(
        schools,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error: any) {
    console.error("Error in getAllSchools:", error);
    next(error);
  }
};

// Get school by id
export const getSchool = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getIdFromToken(req);
    const { id: schoolId } = req.params;

    const userSchool = await validateUserSchool(userId, schoolId);
    if (!userSchool)
      return handleError(res, "School with this user not found", 404);

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return handleError(res, "School not found", 404);

    res.status(200).json({
      success: true,
      message: "School fetched successfully",
      data: school,
    });
  } catch (error: any) {
    console.error("Error in getSchool:", error);
    next(error);
  }
};

// Update school
export const updateSchool = async (
  req: Request<{ id: string }, {}, Partial<ISchoolRequest>>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getIdFromToken(req);
    const { id: schoolId } = req.params;

    const userSchool = await validateUserSchool(userId, schoolId);
    if (!userSchool)
      return handleError(res, "School with this user not found", 404);

    const updatedSchool = await prisma.school.update({
      where: { id: schoolId },
      data: req.body,
    });

    res.status(200).json({
      success: true,
      message: "School updated successfully",
      data: updatedSchool,
    });
  } catch (error: any) {
    console.error("Error in updateSchool:", error);
    next(error);
  }
};

// Delete school
export const deleteSchool = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getIdFromToken(req);
    const { id: schoolId } = req.params;

    const userSchool = await validateUserSchool(userId, schoolId);
    if (!userSchool)
      return handleError(res, "School with this user not found", 404);

    await prisma.school.delete({ where: { id: schoolId } });

    res.status(200).json({
      success: true,
      message: "School deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in deleteSchool:", error);
    next(error);
  }
};
