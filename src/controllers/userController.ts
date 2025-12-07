import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { handleError } from "../error/errorHandler";
import bcrypt from "bcrypt";
import _ from "lodash";

/**
 * Get user profile
 * @route GET /api/user/profile
 */
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        isSuperAdmin: true,
        hasVerifiedEmail: true,
        createdAt: true,
        updatedAt: true,
        userSchools: {
          select: {
            schoolId: true,
            role: true,
            school: {
              select: {
                id: true,
                name: true,
                email: true,
                address: true,
                isActive: true,
              },
            },
          },
        },
        staff: true,
        student: {
          include: {
            student_enrolled: {
              where: { status: "enrolled" },
              include: {
                class: true,
                section: true,
                session: true,
                term: true,
              },
            },
            parent: true,
          },
        },
        parent: {
          include: {
            students: true,
          },
        },
      },
    });

    if (!user) {
      return handleError(res, "User not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * @route PUT /api/user/profile
 */
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user;
    const {
      username,
      email,
      name,
      phone,
      address,
      photo_url,
      currentPassword,
      newPassword,
    } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        staff: true,
        student: true,
        parent: true,
      },
    });

    if (!user) {
      return handleError(res, "User not found", 404);
    }

    // Handle Password Update
    if (newPassword) {
      if (!currentPassword) {
        return handleError(
          res,
          "Current password is required to set a new password",
          400
        );
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isPasswordValid) {
        return handleError(res, "Invalid current password", 401);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
        },
      });
    }

    // Update User Basic Info
    if (username || email) {
      // Check for uniqueness if changing
      if (username && username !== user.username) {
        const existingUsername = await prisma.user.findUnique({
          where: { username },
        });
        if (existingUsername) {
          return handleError(res, "Username already taken", 400);
        }
      }
      if (email && email !== user.email) {
        const existingEmail = await prisma.user.findUnique({
          where: { email },
        });
        if (existingEmail) {
          return handleError(res, "Email already taken", 400);
        }
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          username: username || undefined,
          email: email || undefined,
        },
      });
    }

    // Update Related Profile Info (Staff/Student/Parent)
    // Assuming a user can be only one of these primarily, or we update all if they exist
    const profileUpdates: any = {};
    if (name) profileUpdates.name = name;
    if (phone) profileUpdates.phone = phone; // Note: Staff phone is String[], others are String. Need to handle.
    if (address) profileUpdates.address = address;
    if (photo_url) profileUpdates.photo_url = photo_url;

    if (user.staff) {
      // Staff phone is String[]
      const staffUpdates = { ...profileUpdates };
      if (phone) {
        // If phone is sent as string, convert to array for staff
        staffUpdates.phone = Array.isArray(phone) ? phone : [phone];
      }

      await prisma.staff.update({
        where: { id: user.staff.id },
        data: staffUpdates,
      });
    }

    if (user.student) {
      // Student phone is String
      const studentUpdates = { ...profileUpdates };
      if (phone && Array.isArray(phone)) {
        studentUpdates.phone = phone[0];
      }

      await prisma.student.update({
        where: { id: user.student.id },
        data: studentUpdates,
      });
    }

    if (user.parent) {
      // Parent phone is String
      const parentUpdates = { ...profileUpdates };
      // Parent doesn't have address or photo_url in the schema shown earlier?
      // Let's check schema again.
      // Parent: name, phone, email. No address, no photo_url.

      const validParentUpdates = _.pick(parentUpdates, ["name", "phone"]);
      if (phone && Array.isArray(phone)) {
        validParentUpdates.phone = phone[0];
      }

      await prisma.parent.update({
        where: { id: user.parent.id },
        data: validParentUpdates,
      });
    }

    // Fetch updated user to return
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        staff: true,
        student: true,
        parent: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
