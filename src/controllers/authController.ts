import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import bcrypt from "bcrypt";
import _ from "lodash";
import {
  IUserRequest,
  IStaffRequest,
  IStudentRequest,
  IInitializeSystemRequest,
} from "../types/requests";
import {
  generateOTP,
  generateToken,
  getDecodedTokenFromRequest,
} from "../function/token";
import {
  PrismaClient,
  UserRole as PrismaUserRoleEnum,
  UserRole,
} from "@prisma/client";
import {
  checkIfAdminAction,
  findActiveSession,
  validateSchool,
  validateSection,
} from "../function/schoolFunctions";
import { handleError } from "../error/errorHandler";
import {
  deleteCache,
  getCache,
  setCache,
  addTokenToDenylist,
  checkRateLimit,
} from "../utils/redis";
import { notifyUser } from "../utils/notification";
import logger from "../utils/logger";
import {
  OTP_EXPIRY_SECONDS,
  SENSITIVE_USER_ROLES,
  SENSITIVE_ROLE_TOKEN_EXPIRES_IN,
  OTP_VERIFY_WINDOW_SECONDS,
  OTP_VERIFY_MAX_ATTEMPTS,
  OTP_RESEND_WINDOW_SECONDS,
  OTP_RESEND_MAX_ATTEMPTS,
  REDIS_EMAIL_VERIFICATION_PREFIX,
  REDIS_PASSWORD_RESET_PREFIX,
} from "../config/constants";

// Type for Prisma Transaction Client
type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Validates guardian (parent) details if an existing guardian account is indicated.
 * If `exist_guardian` is true, it attempts to find an existing parent user by email or username
 * and verifies the provided password.
 * @param exist_guardian - Boolean indicating if an existing guardian is being used.
 * @param guardianData - Object containing guardian_email, guardian_username, and guardian_password.
 * @returns The ID of the parent if successfully validated.
 * @throws Error if parent not found or password incorrect.
 */
const getParent = async (
  exist_guardian: boolean,
  guardianData: {
    guardian_emailOrUsername?: string;
    guardian_password?: string;
  }
): Promise<string | null> => {
  if (!exist_guardian) return null;

  const { guardian_emailOrUsername, guardian_password } = guardianData;

  if (!guardian_emailOrUsername) {
    throw new Error(
      "Guardian email or username is required to find an existing guardian."
    );
  }
  if (!guardian_password) {
    throw new Error(
      "Guardian password is required to verify an existing guardian."
    );
  }

  let existingUser: any;

  if (guardian_emailOrUsername) {
    existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: guardian_emailOrUsername },
          { username: guardian_emailOrUsername },
        ],
      },
      select: { parent: { select: { id: true } }, password: true },
    });
  }

  if (!existingUser) {
    throw new Error("Parent not found with the provided email or username.");
  }

  if (existingUser) {
    const isPasswordCorrect = await bcrypt.compare(
      guardian_password,
      existingUser.password
    );
    if (isPasswordCorrect) {
      if (!existingUser.parent?.id) {
        throw new Error("User exists but is not registered as a parent.");
      }
      return existingUser.parent.id;
    } else {
      throw new Error("Invalid parent credentials provided.");
    }
  } else {
    throw new Error("Parent not found with the provided email or username.");
  }
};

/**
 * Creates a new parent User and Parent profile within a Prisma transaction.
 * @param tx - Prisma transactional client.
 * @param guardianData - Object containing guardian details (email, username, password, name, phone).
 * @returns The ID of the newly created Parent profile.
 */
const createParentAccount = async (
  tx: PrismaTransactionClient,
  guardianData: any
): Promise<string> => {
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
      password: hashedGuardianPassword,
      username: guardian_username,
      email: guardian_email,
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

/**
 * Creates a new Student profile and their initial enrollment record within a Prisma transaction.
 * @param tx - Prisma transactional client.
 * @param userId - The ID of the User record for the student.
 * @param parentId - The ID of the linked Parent profile.
 * @param studentData - Object containing student-specific details.
 * @param session - The active academic session object, must include ID.
 * @param termId - The ID of the active term within the session.
 * @returns The newly created Student object.
 */
const _createStudentAndEnrollment = async (
  tx: PrismaTransactionClient,
  isAdminAction: boolean,
  userId: string,
  parentId: string,
  studentData: any,
  session: { id: string },
  termId: string
) => {
  const {
    dob,
    admission_date,
    classId,
    sectionId,
    isActive,
    password,
    username,
    ...studentDataWithoutId
  } = studentData;

  const student = await tx.student.create({
    data: {
      userId,
      parentId,
      dob: new Date(dob),
      admission_date: admission_date ? new Date(admission_date) : new Date(),
      isActive: isAdminAction ? isActive : false,
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
      status: "enrolled",
    },
  });

  return student;
};

/**
 * Internal helper to create student's User, UserSchool, Student profile, and initial StudentEnrollment
 * within a database transaction.
 * @param tx - Prisma transactional client.
 * @param data - Object containing all necessary data for student creation.
 * @returns The created User and Student objects.
 */
const _createStudentUserAndDependenciesInTransaction = async (
  tx: PrismaTransactionClient,
  isAdminAction: boolean,
  data: {
    email: string;
    hashedPassword?: string;
    username: string;
    schoolId: string;
    parentId: string;
    studentData: any;
    session: { id: string };
    termId: string;
  }
) => {
  const {
    email,
    hashedPassword,
    username,
    schoolId,
    parentId,
    studentData,
    session,
    termId,
  } = data;

  const user = await tx.user.create({
    data: { email, password: hashedPassword!, username },
  });

  await tx.userSchool.create({
    data: { userId: user.id, schoolId: schoolId, role: "student" },
  });

  const student = await _createStudentAndEnrollment(
    tx,
    isAdminAction,
    user.id,
    parentId,
    studentData,
    session,
    termId
  );
  return { user, student };
};

/**
 * Internal helper to create staff's User, UserSchool, and Staff profile
 * within a database transaction.
 * @param tx - Prisma transactional client.
 * @param data - Object containing all necessary data for staff creation.
 * @returns The created User object (or just its ID).
 */
export const _createStaffUserAndDependenciesInTransaction = async (
  tx: PrismaTransactionClient,
  data: {
    email: string;
    hashedPassword?: string;
    username: string;
    schoolId: string;
    role: PrismaUserRoleEnum;
    staffProfileData: any;
    classSectionId?: string;
  }
) => {
  const {
    email,
    hashedPassword,
    username,
    schoolId,
    role,
    staffProfileData,
    classSectionId,
  } = data;

  const user = await tx.user.create({
    data: { email, password: hashedPassword!, username },
    select: { id: true },
  });

  await tx.userSchool.create({
    data: { userId: user.id, schoolId: schoolId, role: role },
  });

  const { dob, joining_date, ...otherStaffData } = staffProfileData;
  const staff = await tx.staff.create({
    data: {
      userId: user.id,
      ...otherStaffData,
      dob: dob ? new Date(String(dob)) : undefined,
      joining_date: joining_date ? new Date(String(joining_date)) : undefined,
    },
  });

  if (classSectionId) {
    const validateClassSection = await prisma.class_Section.findUnique({
      where: { id: classSectionId },
    });

    if (validateClassSection) {
      await tx.class_Section.update({
        where: { id: classSectionId },
        data: { teacherId: staff.id },
      });
    }
  }

  return user;
};

/**
 * Initialize system (first-time setup)
 * @route POST /api/auth/initialize
 */
export const initializeSystem = async (
  req: Request<{}, {}, IInitializeSystemRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      superAdminUsername,
      superAdminEmail,
      superAdminPassword,
      schoolName,
      schoolEmail,
      schoolAddress,
      schoolPhone,
    } = req.body;

    // Validate required fields
    if (
      !superAdminUsername ||
      !superAdminEmail ||
      !superAdminPassword ||
      !schoolName ||
      !schoolEmail ||
      !schoolAddress
    ) {
      return handleError(
        res,
        "All fields are required for system initialization",
        400
      );
    }

    // Check if system is already initialized
    const existingSettings = await prisma.systemSettings.findFirst();
    if (existingSettings?.isOnboarded) {
      return handleError(res, "System is already initialized", 400);
    }

    const existingSuperAdmin = await prisma.user.findFirst({
      where: { isSuperAdmin: true },
    });

    if (existingSuperAdmin) {
      logger.warn(
        { superAdminEmail, superAdminUsername },
        "Attempt to create super admin when one already exists."
      );
      return handleError(
        res,
        "Super admin already exists. Cannot create another.",
        400
      );
    }

    // Start transaction for system initialization
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create/Update system settings
      const settings = await tx.systemSettings.upsert({
        where: { id: existingSettings?.id || "" },
        create: {
          appName: schoolName || "EduStack",
          isOnboarded: false,
        },
        update: {
          appName: schoolName || "EduStack",
        },
      });

      // 2. Create super admin user
      const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
      const superAdmin = await tx.user.create({
        data: {
          username: superAdminUsername,
          email: superAdminEmail,
          password: hashedPassword,
          isSuperAdmin: true,
        },
      });

      // 3. Create first school
      const school = await tx.school.create({
        data: {
          name: schoolName,
          email: schoolEmail,
          address: schoolAddress,
          phone: schoolPhone,
        },
      });

      // 4. Link super admin to school
      await tx.userSchool.create({
        data: {
          userId: superAdmin.id,
          schoolId: school.id,
          role: UserRole.super_admin,
        },
      });

      // 5. Update onboarding status
      await tx.onboardingStatus.upsert({
        where: { id: "" },
        create: {
          step1_superAdmin: true,
          step2_schoolSetup: true,
          step3_finalReview: false,
          currentStep: 3,
          completionPercentage: 100.0,
          configData: {
            superAdminId: superAdmin.id,
            schoolId: school.id,
          },
        },
        update: {},
      });

      await tx.systemSettings.update({
        where: { id: settings.id },
        data: { isOnboarded: true },
      });

      return { settings, superAdmin, school };
    });
    logger.info(
      { userId: result.superAdmin.id, username: result.superAdmin.username },
      "Super admin account created, pending OTP verification."
    );

    const otp = generateOTP();
    Promise.all([
      setCache(
        `${REDIS_EMAIL_VERIFICATION_PREFIX}${result.superAdmin.id}`,
        otp,
        OTP_EXPIRY_SECONDS
      ),
      notifyUser({
        userId: result.superAdmin.id,
        email: result.superAdmin.email || "",
        title: "Email Verification OTP",
        message: `Dear ${result.superAdmin.username || "Admin"}, your email verification code is ${otp}.
         \nPlease note that this code will expire in ${OTP_EXPIRY_SECONDS / 60} minutes. 
         \nIf you did not request this code, please ignore this email.`,
        channels: ["EMAIL"],
      }),
    ]).catch((otpError) => {
      logger.error(
        { err: otpError, userId: result.superAdmin.id },
        "Failed to set OTP cache or send notification for super admin signup."
      );
    });

    res.status(201).json({
      success: true,
      message:
        "Account created successfully. Please check your email for verification code.",
      data: {
        superAdmin: result.superAdmin,
        systemSettings: result.settings,
        superAdminCreated: true,
        schoolCreated: true,
      },
    });
  } catch (error: any) {
    logger.error({ err: error, body: req.body }, "Error in superAdminSignUp");
    next(error);
  }
};

/**
 * Handles Staff signup. Creates a User, Staff profile, and links them to a school.
 * @route POST /api/auth/staff-signup
 */
export const staffSignUp = async (
  req: Request<{}, {}, IStaffRequest>,
  res: Response,
  next: NextFunction
) => {
  const reqToken = (req as any).user;
  const isAdminAction = await checkIfAdminAction(reqToken);
  try {
    const {
      username,
      email,
      password,
      schoolId,
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

    const hashedPassword = await bcrypt.hash(password, 10);

    const school = await validateSchool(String(schoolId));
    if (!school) {
      return handleError(res, "School not found or is inactive.", 404);
    }

    const staffProfileData = {
      name,
      phone,
      email,
      address,
      designation,
      dob,
      salary: Number(salary),
      joining_date,
      gender,
      photo_url,
      qualification,
      notes,
      isActive: isAdminAction ? isActive : false,
    };

    const newUser = await prisma.$transaction(async (tx) => {
      return _createStaffUserAndDependenciesInTransaction(tx, {
        email: email || "",
        hashedPassword,
        username,
        schoolId: school.id,
        role: role as PrismaUserRoleEnum,
        classSectionId: isAdminAction ? classSectionId : undefined,
        staffProfileData,
      });
    });
    logger.info(
      { staffUserId: newUser.id, schoolId, role },
      "Staff account created successfully."
    );

    res.status(201).json({
      success: true,
      message: isAdminAction
        ? "Staff created successfully"
        : "Staff created successfully, pending admin approval.",
      data: { userId: newUser.id },
    });
  } catch (error: any) {
    logger.error({ err: error, body: req.body }, "Error in staffSignUp");
    next(error);
  }
};

/**
 * Handles Student signup.
 * @route POST /api/auth/student-signup
 */
export const studentSignUp = async (
  req: Request<{}, {}, IStudentRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const reqToken = (req as any).user;
    const isAdminAction = await checkIfAdminAction(reqToken);

    const {
      schoolId,
      exist_guardian,
      guardian_email,
      guardian_username,
      guardian_emailOrUsername,
      guardian_password,
      guardian_name,
      guardian_phone,
      ...studentData
    } = req.body;

    const { email, username, password } = studentData;

    const school = await validateSchool(String(schoolId));
    if (!school)
      return handleError(res, "School not found or is inactive.", 404);

    const section = await validateSection(
      studentData.classId,
      studentData.sectionId
    );
    if (!section)
      return handleError(res, "Section not found in the specified class.", 404);

    const activeSession = await findActiveSession(res);
    if (!activeSession) return handleError(res, "No active session found", 400);

    const activeTerm = activeSession.terms.find((term) => term.isActive);
    if (!activeTerm)
      return handleError(
        res,
        "No active term found in the current session.",
        400
      );

    const hashedPassword = await bcrypt.hash(password, 10);

    let parentId: string | null = null;
    if (exist_guardian) {
      try {
        parentId = await getParent(exist_guardian, {
          guardian_emailOrUsername,
          guardian_password,
        });
      } catch (error: any) {
        logger.warn(
          {
            guardianEmail: guardian_email,
            guardianUsername: guardian_username,
            error: error.message,
          },
          "Failed to get parent during student signup."
        );
        return handleError(res, error.message, 401);
      }
    } else {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: guardian_email }, { username: guardian_username }],
        },
      });
      if (existingUser) {
        return handleError(
          res,
          "Guardian email or username already exists, please use a different one or tick the exist parent checkbox.",
          400
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      if (!parentId && !exist_guardian) {
        const parentGuardianData = {
          guardian_email,
          guardian_username,
          guardian_password,
          guardian_name,
          guardian_phone,
        };
        parentId = await createParentAccount(tx, parentGuardianData);
        logger.info(
          { parentId, studentEmail: email },
          "New parent account created during student signup."
        );
      } else if (!parentId && exist_guardian) {
        logger.error(
          { guardianEmail: guardian_email },
          "Parent ID not established despite exist_guardian=true."
        );
        throw new Error(
          "Parent account could not be established. Please check guardian details."
        );
      }

      return _createStudentUserAndDependenciesInTransaction(tx, isAdminAction, {
        email: email!,
        hashedPassword,
        username,
        schoolId: school.id,
        parentId: parentId!,
        studentData,
        session: activeSession,
        termId: activeTerm.id,
      });
    });
    logger.info(
      { studentUserId: result.user.id, schoolId },
      "Student account created and enrolled successfully."
    );

    const responseUserData = _.omit(result.user, ["password"]);

    res.status(201).json({
      success: true,
      message: isAdminAction
        ? "Student created successfully"
        : "Student created successfully, pending admin approval.",
      data: { userData: responseUserData, student: result.student },
    });
  } catch (error) {
    logger.error({ err: error, body: req.body }, "Error in studentSignUp");
    next(error);
  }
};

/**
 * Handles user sign-in for all roles.
 * @route POST /api/auth/signin
 */
export const userSignIn = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { emailOrUsername, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
      select: {
        id: true,
        email: true,
        username: true,
        isSuperAdmin: true,
        hasVerifiedEmail: true,
        userSchools: {
          select: {
            schoolId: true,
            role: true,
            school: { select: { name: true, isActive: true } },
          },
        },
        staff: true,
        student: {
          include: { student_enrolled: { where: { status: "enrolled" } } },
        },
        parent: {
          include: {
            students: {
              include: { student_enrolled: { where: { status: "enrolled" } } },
            },
          },
        },
        password: true,
      },
    });

    if (!user) {
      return handleError(res, "Invalid credentials. User not found.", 404);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return handleError(res, "Invalid credentials. Password incorrect.", 401);
    }

    if (!user.isSuperAdmin) {
      if (user.staff && !user.staff.isActive) {
        return handleError(
          res,
          "Your staff account is inactive, please contact school admin.",
          401
        );
      }
      if (user.student && !user.student.isActive) {
        return handleError(
          res,
          "Your student account is inactive, please contact school admin.",
          401
        );
      }
    }

    if (!user.hasVerifiedEmail && !user.isSuperAdmin && !user.student) {
      return handleError(
        res,
        "Your email is not verified, please verify your email first.",
        401,
        { userId: user.id }
      );
    }

    const expire =
      user.userSchools.some(
        (us) => us.role && SENSITIVE_USER_ROLES.includes(us.role)
      ) || user.isSuperAdmin
        ? SENSITIVE_ROLE_TOKEN_EXPIRES_IN
        : undefined;

    const token = generateToken({ id: user.id, expire });
    const userDataToReturn = _.omit(user, [
      "password",
      "userSchools",
      "staff",
      "student",
      "parent",
    ]);
    logger.info(
      { userId: user.id, username: user.username },
      "User signed in successfully."
    );

    res.status(200).json({
      success: true,
      message: "User signed in successfully",
      data: {
        userData: userDataToReturn,
        userSchools: user.userSchools,
        staff: user.staff,
        student: user.student,
        parent: user.parent,
        token,
      },
    });
  } catch (error) {
    logger.error({ err: error, body: req.body }, "Error in userSignIn");
    next(error);
  }
};

/**
 * Verifies an email OTP provided by the user.
 * @route POST /api/auth/verify-email-otp
 */
export const verifyEmailOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, otp } = req.body;

    if (!userId) {
      return handleError(res, "User ID is required for OTP verification.", 400);
    }

    const limitCheckVerify = await checkRateLimit(
      "otp_verify",
      userId,
      OTP_VERIFY_WINDOW_SECONDS,
      OTP_VERIFY_MAX_ATTEMPTS
    );

    if (!limitCheckVerify.allow) {
      const retryMinutes = Math.ceil(
        (limitCheckVerify.retryAfterSeconds || OTP_VERIFY_WINDOW_SECONDS) / 60
      );
      const message = `Too many OTP verification attempts. Try again in ${retryMinutes} minutes.`;
      logger.warn(
        { userId, attempts: limitCheckVerify.attemptsMade },
        "OTP verification rate limit exceeded."
      );
      return handleError(res, message, 429);
    }

    const storedOTP = await getCache(
      `${REDIS_EMAIL_VERIFICATION_PREFIX}${userId}`
    );
    if (!storedOTP)
      return handleError(
        res,
        "OTP expired or invalid. Please request a new one.",
        400
      );
    if (otp !== storedOTP)
      return handleError(res, "Invalid OTP provided.", 400);

    await deleteCache(`${REDIS_EMAIL_VERIFICATION_PREFIX}${userId}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        isSuperAdmin: true,
        userSchools: { select: { schoolId: true, role: true } },
        staff: true,
        student: true,
        parent: true,
      },
    });

    if (!user)
      return handleError(res, "User not found after OTP verification.", 404);

    await prisma.user.update({
      where: { id: userId },
      data: { hasVerifiedEmail: true },
    });

    const expire =
      user.userSchools.some(
        (us) => us.role && SENSITIVE_USER_ROLES.includes(us.role)
      ) || user.isSuperAdmin
        ? SENSITIVE_ROLE_TOKEN_EXPIRES_IN
        : undefined;
    const token = generateToken({ id: user.id, expire });

    await notifyUser({
      userId: user.id,
      email: user.email || "",
      title: "Email Verified",
      message: "Your email has been successfully verified.",
      category: "GENERAL",
      channels: ["IN_APP"],
    });
    logger.info({ userId }, "Email verified successfully via OTP.");

    const userDataToReturn = _.omit(user, [
      "userSchools",
      "staff",
      "student",
      "parent",
    ]);
    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {
        userData: userDataToReturn,
        userSchools: user.userSchools,
        staff: user.staff,
        student: user.student,
        parent: user.parent,
        token,
      },
    });
  } catch (error) {
    logger.error({ err: error, body: req.body }, "Error in verifyEmailOTP");
    next(error);
  }
};

/**
 * Helper function to generate, store, and send an OTP.
 */
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
  type?: "email_verification" | "password_reset";
  subject?: string;
  messagePrefix?: string;
}): Promise<string> => {
  const otp = generateOTP();
  const prefix =
    type === "password_reset"
      ? REDIS_PASSWORD_RESET_PREFIX
      : REDIS_EMAIL_VERIFICATION_PREFIX;
  const cacheKey = `${prefix}${userId}`;

  const existingOTP = await getCache(cacheKey);
  if (existingOTP) await deleteCache(cacheKey);

  await setCache(cacheKey, otp, OTP_EXPIRY_SECONDS);

  notifyUser({
    userId,
    email,
    title: subject,
    message: `Dear ${username || "user"},  Your ${messagePrefix} code is ${otp}. \nPlease note that this code will expire in ${OTP_EXPIRY_SECONDS / 60} minutes. \nIf you did not request this code, please ignore this email.`,
    channels: ["EMAIL"],
  }).catch((err) =>
    logger.error(
      { err, userId, email, type },
      "Failed to send OTP notification via handleOTP"
    )
  );

  return otp;
};

/**
 * Handles resending of OTPs.
 * @route POST /api/auth/resend-otp
 */
export const resendOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, type } = req.body as {
      id?: string;
      type: "email_verification" | "password_reset";
    };

    if (!id) {
      return handleError(
        res,
        "User identifier (id or email) is required for OTP resend.",
        400
      );
    }

    const limitCheckResend = await checkRateLimit(
      "otp_resend",
      id,
      OTP_RESEND_WINDOW_SECONDS,
      OTP_RESEND_MAX_ATTEMPTS
    );

    if (!limitCheckResend.allow) {
      const retryMinutes = Math.ceil(
        (limitCheckResend.retryAfterSeconds || OTP_RESEND_WINDOW_SECONDS) / 60
      );
      const message = `Too many OTP resend requests. Try again in ${retryMinutes} minutes.`;
      logger.warn(
        { id, type, attempts: limitCheckResend.attemptsMade },
        "OTP resend rate limit exceeded."
      );
      return handleError(res, message, 429);
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, username: true },
    });

    if (!user) return handleError(res, "User not found.", 404);
    if (!user.email)
      return handleError(
        res,
        "User email is required for OTP operation and is missing.",
        400
      );

    await handleOTP({
      userId: user.id,
      email: user.email,
      username: user.username || "user",
      type: type,
      subject:
        type === "password_reset"
          ? "Password Reset OTP"
          : "Email Verification OTP",
      messagePrefix:
        type === "password_reset" ? "Password reset" : "Email verification",
    });
    logger.info({ id, type }, "OTP resent successfully.");

    const token = generateToken({
      id: user.id,
      expire: "15m",
    });
    res.status(200).json({
      success: true,
      message: "OTP resent successfully.",
      token: type === "password_reset" ? token : undefined,
    });
  } catch (error) {
    logger.error({ err: error, body: req.body }, "Error in resendOTP");
    next(error);
  }
};

/**
 * Initiates a password reset request.
 * @route POST /api/auth/request-reset
 */
export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, username: true },
    });

    if (!user || !user.email) {
      logger.warn(
        { emailProvided: email },
        "Password reset requested for non-existent or email-less user. Responding ambiguously."
      );
      res.status(200).json({
        success: true,
        message:
          "If an account with this email exists, a password reset OTP has been sent.",
      });
      return;
    }

    await handleOTP({
      userId: user.id,
      email: user.email,
      username: user.username || "user",
      type: "password_reset",
      subject: "Password Reset OTP",
      messagePrefix: "password reset",
    });
    logger.info({ userId: user.id, email }, "Password reset OTP sent.");

    const shortLivedToken = generateToken({
      id: user.id,
      expire: "15m",
    });

    res.status(200).json({
      success: true,
      message:
        "If an account with this email exists, a password reset OTP has been sent.",
      token: shortLivedToken,
    });
  } catch (error) {
    logger.error(
      { err: error, body: req.body },
      "Error in requestPasswordReset"
    );
    next(error);
  }
};

/**
 * Resets a user's password.
 * @route POST /api/auth/reset-password
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { otp, newPassword } = req.body;

    const token = getDecodedTokenFromRequest(req);
    if (!token) return handleError(res, "Invalid or expired token.", 400);
    const userId = token.id;

    const storedOTP = await getCache(`${REDIS_PASSWORD_RESET_PREFIX}${userId}`);
    if (!storedOTP || storedOTP !== otp)
      return handleError(res, "Invalid or expired OTP.", 400);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });

    await deleteCache(`${REDIS_PASSWORD_RESET_PREFIX}${userId}`);
    await notifyUser({
      userId,
      email: "",
      title: "Password Reset Successful",
      message: "Your password was successfully reset.",
      category: "GENERAL",
      channels: ["IN_APP"],
    });
    logger.info({ userId }, "Password reset successfully.");

    res
      .status(200)
      .json({ success: true, message: "Password reset successful." });
  } catch (error) {
    logger.error({ err: error, body: req.body }, "Error in resetPassword");
    next(error);
  }
};

/**
 * Logs out a user.
 * @route POST /api/auth/logout
 */
export const logoutUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const currentDecodedToken = getDecodedTokenFromRequest(req);

    if (
      !currentDecodedToken ||
      !currentDecodedToken.jti ||
      !currentDecodedToken.exp
    ) {
      logger.warn(
        { userId: (req as any).user, path: req.path },
        "Logout attempt with malformed or missing token details after verifyToken."
      );
      return handleError(
        res,
        "No active session found or token is malformed.",
        400
      );
    }

    const { jti, exp, id: userId } = currentDecodedToken;

    const successfullyDenylisted = await addTokenToDenylist(jti, exp);

    if (!successfullyDenylisted) {
      logger.error(
        { jti, userId },
        "Failed to denylist token during logout. Token may remain valid until natural expiry."
      );
    } else {
      logger.info(
        { jti, userId },
        "User logged out successfully, token JTI denylisted."
      );
    }

    res.status(200).json({
      success: true,
      message: "User logged out successfully.",
    });
  } catch (error: any) {
    logger.error(
      { err: error, userId: (req as any).user },
      "Error during logout"
    );
    next(error);
  }
};
