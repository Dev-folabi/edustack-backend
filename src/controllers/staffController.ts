import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import bcrypt from "bcrypt";
import { handleError } from "../error/errorHandler";
import { IStaffRequest } from "../types/requests";
import {
  checkIfAdminAction,
  validateSchool,
} from "../function/schoolFunctions";
import logger from "../utils/logger";
import { paginateResults } from "../function/pagination";

export const getStaffsBySchool = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(parseInt(req.query?.page as string, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query?.limit as string, 10) || 10, 1);

    const { schoolId } = req.params;
    const { role } = req.query;

    const school = await validateSchool(String(schoolId));
    if (!school) {
      return handleError(res, "School not found or is inactive.", 404);
    }

    const whereFilter: any = {
      schoolId: schoolId,
      user: {
        staff: { isNot: null },
      },
    };
    if (role) {
      whereFilter.role = role;
    }

    const staffs = await prisma.userSchool.findMany({
      where: whereFilter,
      orderBy: { createdAt: "desc" },
      select: {
        role: true,
        user: {
          select: {
            username: true,
            email: true,
            staff: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                address: true,
                designation: true,
                dob: true,
                salary: true,
                joining_date: true,
                gender: true,
                photo_url: true,
                qualification: true,
                notes: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    const totalCount = staffs.length;

    res.status(200).json({
      success: true,
      message: "Staffs retrieved successfully",
      data: paginateResults(staffs, page, limit, totalCount),
    });
  } catch (error) {
    logger.error({ err: error }, "Error in getStaffsBySchool");
    next(error);
  }
};

export const getStaffById = async (
  req: Request<{ staffId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { staffId } = req.params;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        designation: true,
        dob: true,
        salary: true,
        joining_date: true,
        gender: true,
        photo_url: true,
        qualification: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            username: true,
            email: true,
            userSchools: {
              select: {
                role: true,
                school: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        class_teacher: {
          select: {
            id: true,
            name: true,
            classId: false,
            classes: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!staff) {
      return handleError(res, "Staff member not found.", 404);
    }

    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    logger.error({ err: error, params: req.params }, "Error in getStaffById");
    next(error);
  }
};

export const updateStaff = async (
  req: Request<{ staffId: string }, {}, Partial<IStaffRequest>>,
  res: Response,
  next: NextFunction
) => {
  const reqToken = (req as any).user;
  const isAdminAction = await checkIfAdminAction(reqToken);

  try {
    const { staffId } = req.params;
    const {
      username,
      email,
      password,
      role,
      name,
      phone,
      address,
      designation,
      dob,
      salary,
      joining_date,
      gender,
      photo_url,
      qualification,
      notes,
      isActive,
      classSectionId,
    } = req.body;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: { user: { include: { userSchools: true } } },
    });

    if (!staff) {
      return handleError(res, "Staff not found.", 404);
    }

    if (!isAdminAction && reqToken !== staff.userId) {
      return handleError(
        res,
        "You are not authorized to update this staff member.",
        403
      );
    }

    if (username || email) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ username }, { email }],
        },
      });
      if (user) {
        return handleError(res, "Username or email already exists.", 400);
      }
    }

    const userUpdateData: any = {};
    if (username) userUpdateData.username = username;
    if (email) userUpdateData.email = email;
    if (password && isAdminAction) {
      userUpdateData.password = await bcrypt.hash(password, 10);
    }

    const staffUpdateData: any = {};
    if (name) staffUpdateData.name = name;
    if (phone) staffUpdateData.phone = phone;
    if (address) staffUpdateData.address = address;
    if (designation) staffUpdateData.designation = designation;
    if (dob) staffUpdateData.dob = new Date(String(dob));
    if (salary !== undefined && isAdminAction) staffUpdateData.salary = salary;
    if (joining_date)
      staffUpdateData.joining_date = new Date(String(joining_date));
    if (gender) staffUpdateData.gender = gender;
    if (photo_url) staffUpdateData.photo_url = photo_url;
    if (qualification) staffUpdateData.qualification = qualification;
    if (notes) staffUpdateData.notes = notes;
    if (isActive !== undefined && isAdminAction) {
      staffUpdateData.isActive = isActive;
    }

    const userSchoolUpdateData: any = {};
    if (role && isAdminAction) {
      userSchoolUpdateData.role = role;
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdateData).length) {
        await tx.user.update({
          where: { id: staff.userId },
          data: userUpdateData,
        });
      }

      if (Object.keys(staffUpdateData).length) {
        await tx.staff.update({
          where: { id: staffId },
          data: staffUpdateData,
        });
      }

      if (Object.keys(userSchoolUpdateData).length) {
        await tx.userSchool.update({
          where: {
            userId_schoolId: {
              userId: staff.userId,
              schoolId: staff.user.userSchools[0].schoolId,
            },
          },
          data: userSchoolUpdateData,
        });
      }

      if (classSectionId && isAdminAction) {
        const validateClassSection = await prisma.class_Section.findUnique({
          where: { id: classSectionId },
        });
        if (validateClassSection) {
          await tx.class_Section.update({
            where: { id: classSectionId },
            data: { teacherId: staff.id },
          });
        } else {
          return handleError(res, "Class section not found.", 404);
        }
      }
    });

    res.status(200).json({
      success: true,
      message: "Staff updated successfully.",
    });
  } catch (error) {
    logger.error({ err: error, body: req.body }, "Error in updateStaff");
    next(error);
  }
};

export const deleteStaff = async (
  req: Request<{ staffId: string }>,
  res: Response,
  next: NextFunction
) => {
  const reqToken = (req as any).user;
  try {

    const { staffId } = req.params;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, userId: true, user: { include: { userSchools: true } } },
    });

    if (!staff) {
      return handleError(res, "Staff member not found.", 404);
    }

    await prisma.staff.update({
      where: { id: staff.id },
      data: { isActive: false },
    });

    await prisma.staff.delete({ where: { id: staff.id } });
    await prisma.user.delete({ where: { id: staff.userId } });

    logger.info(
      { staffId, deletedBy: reqToken.id },
      "Staff deleted successfully."
    );

    res.status(200).json({
      success: true,
      message: "Staff account deleted successfully.",
    });
  } catch (error) {
    logger.error({ err: error, params: req.params }, "Error in deleteStaff");
    next(error);
  }
};
