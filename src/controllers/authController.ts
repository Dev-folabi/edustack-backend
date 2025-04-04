import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import bcrypt from "bcrypt";
import _ from "lodash";
import {
  IUserRequest,
  IStaffRequest,
  IStudentRequest,
} from "../types/requests";
import { generateToken } from "../function/token";
import { UserRole } from "@prisma/client";
import { findActiveSession, validateSchool } from "../function/schoolFunctions";
import { handleError } from "../error/errorHandler";
import { deleteCache, getCache, setCache } from "../utils/redis";
import sendMail, { notifyUser } from "../utils/mail";

const sensitiveRoles = ["super_admin", "admin", "finance"];

// Validate class-section existence
const validateSection = async (classId: string, sectionId: string) => {
  return prisma.class_Section.findFirst({
    where: { id: sectionId, classId },
  });
};

// Validate guardian details and return parent ID
const getOrCreateParent = async (
  exist_guardian: boolean,
  guardianData: any
): Promise<string> => {
  if (!exist_guardian) return "";

  const { guardian_email, guardian_username, guardian_password } = guardianData;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: guardian_email }, { username: guardian_username }],
    },
    select: { parent: true, password: true },
  });

  if (existingUser) {
    const isPasswordCorrect = await bcrypt.compare(
      guardian_password,
      existingUser.password
    );
    if (isPasswordCorrect) {
      return existingUser.parent?.id || "";
    } else {
      throw new Error("Parent password is incorrect");
    }
  } else {
    throw new Error("Parent not found");
  }
};

// Create a new parent account
const createParentAccount = async (guardianData: any, tx: any) => {
  const {
    guardian_email,
    guardian_username,
    guardian_password,
    guardian_name,
    guardian_phone,
  } = guardianData;

  const hashedGuardianPassword = await bcrypt.hash(guardian_password, 10);

  const parentUser = await tx.user.create({
    data: {
      email: guardian_email,
      password: hashedGuardianPassword,
      username: guardian_username,
    },
  });

  const parentAccount = await tx.parent.create({
    data: {
      userId: parentUser.id,
      name: guardian_name || "",
      phone: Array.isArray(guardian_phone)
        ? guardian_phone.join(", ")
        : guardian_phone,
      email: guardian_email,
    },
  });

  return parentAccount.id;
};

// Create the student account
const createStudent = async (
  tx: any,
  userId: string,
  parentId: string,
  studentData: any,
  session: any,
  termId: string
) => {
  const { dob, admission_date, classId, sectionId, ...studentDataWithoutId } =
    studentData;

  const student = await tx.student.create({
    data: {
      userId,
      parentId,
      dob: new Date(dob),
      admission_date: new Date(admission_date),
      isActive: false,
      ...studentDataWithoutId,
    },
  });

  await tx.studentEnrollment.create({
    data: {
      studentId: student.id,
      classId,
      sectionId,
      sessionId: session.id,
      termId,
      status: "pending",
    },
  });

  return student;
};

// Super Admin Sign Up
export const superAdminSignUp = async (
  req: Request<{}, {}, IUserRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, username } = req.body;

    // Check if super admin already exists
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { isSuperAdmin: true },
    });

    if (existingSuperAdmin) {
      return handleError(res, "Super admin already exists", 400);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        username,
        isSuperAdmin: true,
      },
      select: {
        id: true,
        email: true,
        username: true,
        isSuperAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP in Redis with 15 minute expiry
    Promise.all([
      setCache(`email_verification_${user.id}`, otp, 900),
      await notifyUser({
        userId: user.id,
        email: user.email || "",
        title: "Email Verification OTP",
        message: `Dear ${user.username || "Admin"}, your email verification code is ${otp}. 
        Please note that this code will expire in 15 minutes. 
        If you did not request this code, please ignore this email.`,
        channels: ["EMAIL"],
      }),
    ]);

    // Send success response
    res.status(201).json({
      success: true,
      message:
        "Account created successfully. Please check your email for verification code",
      data: user,
    });
  } catch (error: any) {
    next(error);
  }
};

// Staff Sign Up
export const staffSignUp = async (
  req: Request<{}, {}, IStaffRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      username,
      email,
      password,
      name,
      phone,
      address,
      schoolId,
      designation,
      role,
      dob,
      salary,
      joining_date,
      gender,
      photo_url,
      qualification,
      notes,
    } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Validate school existence
    const school = await validateSchool(String(schoolId));
    if (!school) {
      return handleError(res, "School not found", 404);
    }

    let newUser!: { id: string };
    await prisma.$transaction(async (tx) => {
      // Create user
      newUser = await tx.user.create({
        data: { email, password: hashedPassword, username },
        select: { id: true },
      });

      // Link user to school
      await tx.userSchool.create({
        data: {
          userId: newUser.id,
          schoolId: school.id,
          role: role as UserRole,
        },
      });

      // Create staff profile
      await tx.staff.create({
        data: {
          userId: newUser.id,
          name,
          phone,
          email,
          address,
          designation,
          dob: new Date(String(dob)),
          salary,
          joining_date: new Date(String(joining_date)),
          gender,
          photo_url,
          qualification,
          notes,
        },
      });
    });

    // Generate token
    const token = generateToken({ id: newUser.id });

    // Success response
    res.status(201).json({
      success: true,
      message: "Staff created successfully",
      data: { newUser, token },
    });
  } catch (error: any) {
    console.error("Error in staffSignUp:", error);
    next(error);
  }
};

// Student Sign Up
export const studentSignUp = async (
  req: Request<{}, {}, IStudentRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      email,
      password,
      username,
      schoolId,
      exist_guardian,
      ...studentData
    } = req.body;

    // Validate school existence
    const school = await validateSchool(String(schoolId));
    if (!school) return handleError(res, "School not found", 404);

    // Validate section existence in class
    const section = await validateSection(
      studentData.classId,
      studentData.sectionId
    );
    if (!section) return handleError(res, "Section not found in class", 404);

    // Validate session and term
    const session = await findActiveSession(res);
    if (!session) return;
    const termId = session.terms.find((term) => term.isActive)?.id;
    if (!termId) return handleError(res, "No active term in session", 400);

    // Handle password hashing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Validate guardian if exists
    let parentId = "";
    if (exist_guardian) {
      try {
        parentId = await getOrCreateParent(exist_guardian, req.body);
      } catch (error: any) {
        return handleError(res, error.message, 401);
      }
    }

    // Database transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, password: hashedPassword, username },
      });

      if (!parentId) {
        parentId = await createParentAccount(req.body, tx);
      }

      await tx.userSchool.create({
        data: { userId: user.id, schoolId: school.id, role: "student" },
      });

      const student = await createStudent(
        tx,
        user.id,
        parentId,
        studentData,
        session,
        termId
      );

      return { user, student };
    });

    // Generate token
    const token = generateToken({ id: result.user.id });

    // Prepare response data
    const userData = _.omit(result.user, ["password"]);

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: { userData, student: result.student, token },
    });
  } catch (error) {
    next(error);
  }
};

// User Sign In
export const userSignIn = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { emailOrUsername, password } = req.body;

    const result = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
      select: {
        id: true,
        email: true,
        username: true,
        isSuperAdmin: true,
        userSchools: true,
        staff: true,
        student: true,
        parent: true,
        password: true,
      },
    });

    if (!result) {
      return handleError(res, "User not found", 404);
    }

    const isPasswordValid = await bcrypt.compare(password, result.password);
    if (!isPasswordValid) {
      return handleError(res, "Invalid login details", 401);
    }

    // Set shorter expiry for sensitive roles
    const expire =
      result.userSchools.some(
        (us) => us.role && sensitiveRoles.includes(us.role)
      ) || result.isSuperAdmin
        ? "1h"
        : "1d";

    const token = generateToken({ id: result.id, expire });

    const userData = _.omit(result, [
      "password",
      "userSchools",
      "staff",
      "student",
      "parent",
    ]);

    res.status(200).json({
      success: true,
      message: "User signed in successfully",
      data: {
        userData,
        userSchools: result.userSchools,
        staff: result.staff,
        student: result.student,
        parent: result.parent,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Verify Email OTP
export const verifyEmailOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, otp } = req.body;

    // Get stored OTP from Redis
    const storedOTP = await getCache(`email_verification_${userId}`);

    if (!storedOTP) {
      return handleError(res, "OTP expired or invalid", 400);
    }

    if (otp !== storedOTP) {
      return handleError(res, "Invalid OTP", 400);
    }

    // Get user
    const result = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        isSuperAdmin: true,
        userSchools: true,
        staff: true,
        student: true,
        parent: true,
        password: true,
      },
    });

    if (!result) {
      return handleError(res, "User not found", 404);
    }
    // Set shorter expiry for sensitive roles
    const expire =
      result.userSchools.some(
        (us) => us.role && sensitiveRoles.includes(us.role)
      ) || result.isSuperAdmin
        ? "1h"
        : "1d";

    // Generate token
    const token = generateToken({ id: result.id, expire });

    // Create notification
    await notifyUser({
      userId: result.id,
      email: result.email || "",
      title: "Email Verified",
      message: "Your email has been successfully verified",
      category: "GENERAL",
      channels: ["IN_APP"],
    });

    const userData = _.omit(result, [
      "userSchools",
      "staff",
      "student",
      "parent",
    ]);

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {
        userData,
        userSchools: result.userSchools,
        staff: result.staff,
        student: result.student,
        parent: result.parent,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to handle OTP operations
const handleOTP = async ({
  userId,
  email,
  username,
  type = "email_verification",
  subject = "Email Verification OTP",
  messagePrefix = "email verification",
}: {
  userId: string;
  email: string;
  username: string;
  type?: string;
  subject?: string;
  messagePrefix?: string;
}) => {
  // Generate new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const cacheKey = `${type}_${userId}`;

  // Clear existing OTP if present
  const existingOTP = await getCache(cacheKey);
  if (existingOTP) {
    await deleteCache(cacheKey);
  }

  // Save new OTP with 15 min expiry
  await setCache(cacheKey, otp, 900);

  // Send OTP email
  await notifyUser({
    userId,
    email,
    title: subject,
    message: `Dear ${username || "user"},  Your ${messagePrefix} code is ${otp}. 
    Please note that this code will expire in 15 minutes. 
     If you did not request this code, please ignore this email.`,
    channels: ["EMAIL"],
  });

  return otp;
};

export const resendOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, email, type } = req.body;

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id }, { email }],
      },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    if (!user) {
      return handleError(res, "User not found", 404);
    }

    // Configure OTP based on type
    const otpConfig = {
      userId: user.id,
      email: user.email,
      username: user.username,
      type: (type as string) || "email_verification",
      subject:
        type === "password_reset"
          ? "Password Reset OTP"
          : "Email Verification OTP",
      messagePrefix:
        type === "password_reset" ? "Password reset" : "Email verification",
    };

    // Ensure email is not null before passing to handleOTP
    if (!user.email) {
      return handleError(res, "User email is required", 400);
    }

    await handleOTP({
      ...otpConfig,
      email: user.email,
    });

    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Request Password Reset
export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    if (!user) {
      return handleError(res, "User not found", 404);
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Check if there's an existing OTP and delete it
    const existingOTP = await getCache(`password_reset_${user.id}`);
    if (existingOTP) {
      await deleteCache(`password_reset_${user.id}`);
    }

    // Save new OTP in Redis with 15 minute expiry
    await setCache(`password_reset_${user.id}`, otp, 900);

    // Send password reset email
    await sendMail({
      email: user.email!,
      subject: "Password Reset OTP",
      message: `Dear ${user.username || "user"}, 
      Your password reset code is ${otp}. Please note that this code will expire in 15 minutes. 
      If you did not request this code, please ignore this email.`,
    });

    res.status(200).json({
      success: true,
      message: "Password reset OTP sent successfully",
      data: { userId: user.id },
    });
  } catch (error) {
    next(error);
  }
};

// Reset Password
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, otp, newPassword } = req.body;

    // Get stored OTP from Redis
    const storedOTP = await getCache(`password_reset_${userId}`);

    if (!storedOTP || storedOTP !== otp) {
      return handleError(res, "Invalid or expired OTP", 400);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Delete OTP from Redis
    await deleteCache(`password_reset_${userId}`);

    // Create notification
    await notifyUser({
      userId,
      email: "",
      title: "Password Reset",
      message: "Your password was successfully reset",
      category: "GENERAL",
      channels: ["IN_APP"],
    });

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    next(error);
  }
};
