import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { getDecodedTokenFromRequest } from "../function/token";
import { isTokenDenylisted } from "../utils/redis";
import { UserRole as PrismaUserRole } from "@prisma/client";
import logger from "../utils/logger";

/**
 * Local error handler function for sending immediate HTTP responses from within middleware.
 * Note: This is a convenience for direct responses; for unexpected errors, `next(error)` is preferred.
 * @param res - The Express response object.
 * @param status - The HTTP status code.
 * @param message - The error message to send.
 */
const handleError = (res: Response, status: number, message: string) => {
  res.status(status).json({ success: false, message });
};

/**
 * Checks if a user has any of the specified roles within a given school.
 * This function is context-aware, requiring both `userId` and `schoolId`.
 * @param userId - The ID of the user.
 * @param schoolId - The ID of the school in which the role is being checked.
 * @param roles - An array of `PrismaUserRole` to check against.
 * @returns True if the user has one of the specified roles in the school, false otherwise or on error.
 */
const hasAnyRole = async (userId: string, schoolId: string, roles: PrismaUserRole[]): Promise<boolean> => {
  if (!userId || !schoolId || roles.length === 0) {
    return false;
  }
  try {
    const userSchoolLink = await prisma.userSchool.findUnique({
      where: {
        userId_schoolId: {
          userId,
          schoolId,
        }
      },
      select: { role: true }
    });
    return (userSchoolLink?.role && roles.includes(userSchoolLink.role)) || false;
  } catch (error) {
    logger.error({ err: error, userId, schoolId, roles }, "Error in hasAnyRole check");
    return false;
  }
};

/**
 * Middleware to verify a JWT token from the request.
 * It checks for token presence, validity, JTI (for revocation), denylist status,
 * and whether the token was issued before a password change.
 * If all checks pass, it attaches the user ID to `(req as any).user` and calls `next()`.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedToken = getDecodedTokenFromRequest(req);

    if (!decodedToken) {
      return handleError(res, 401, "Invalid or missing token.");
    }

    // JTI (JWT ID) is essential for revocation checks.
    if (!decodedToken.jti) {
      logger.error({ userId: decodedToken.id, path: req.path }, "Token missing JTI in verifyToken");
      return handleError(res, 401, "Token format unacceptable for revocation check.");
    }

    // Check if the token's JTI is in the denylist (e.g., after logout).
    const isRevoked = await isTokenDenylisted(decodedToken.jti);
    if (isRevoked) {
      logger.warn({ jti: decodedToken.jti, userId: decodedToken.id, path: req.path }, "Revoked token usage attempt in verifyToken");
      return handleError(res, 401, "Token has been revoked.");
    }

    // IAT (Issued At) claim is essential for password change validation.
    const tokenIssuedAt = (decodedToken as any).iat;
    if (!tokenIssuedAt || typeof tokenIssuedAt !== 'number') {
        logger.error({ userId: decodedToken.id, path: req.path }, "Token missing IAT in verifyToken");
        return handleError(res, 401, "Token format unacceptable for timestamp check.");
    }

    // Fetch user's passwordChangedAt timestamp to invalidate old tokens.
    const userProfile = await prisma.user.findUnique({
      where: { id: decodedToken.id },
      select: { passwordChangedAt: true },
    });

    if (!userProfile) {
      logger.warn({ userId: decodedToken.id, path: req.path }, "User profile not found for token in verifyToken");
      return handleError(res, 401, "User profile not found for token.");
    }

    // If passwordChangedAt exists and the token was issued before this time, invalidate it.
    if (userProfile.passwordChangedAt && (tokenIssuedAt < Math.floor(userProfile.passwordChangedAt.getTime() / 1000))) {
      logger.warn({ userId: decodedToken.id, path: req.path, token_iat: tokenIssuedAt, pwd_changed: userProfile.passwordChangedAt }, "Token invalidated due to password change in verifyToken");
      return handleError(res, 401, "Token invalidated due to password change.");
    }

    (req as any).user = decodedToken.id;
    next();
  } catch (error: any) {
    logger.error({ err: error, path: req.path }, "Error in verifyToken middleware");
    next(error);
  }
};

/**
 * Middleware for role-based authorization.
 * It first performs all checks from `verifyToken` (JTI, denylist, passwordChangedAt).
 * Then, it checks if the user is a super_admin or has one of the specified `roles`
 * within a given school context (if `schoolId` is provided).
 * @param roles - An array of `PrismaUserRole` that are allowed to access the route.
 */
export const roleAuthorization = (roles: PrismaUserRole[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const decodedToken = getDecodedTokenFromRequest(req);

      if (!decodedToken) {
        return handleError(res, 401, "Invalid or missing token.");
      }

      if (!decodedToken.jti) {
        logger.error({ userId: decodedToken.id, path: req.path }, "Token missing JTI in roleAuthorization");
        return handleError(res, 401, "Token format unacceptable for revocation check.");
      }

      const isRevoked = await isTokenDenylisted(decodedToken.jti);
      if (isRevoked) {
        logger.warn({ jti: decodedToken.jti, userId: decodedToken.id, path: req.path }, "Revoked token usage attempt in roleAuthorization");
        return handleError(res, 401, "Token has been revoked.");
      }

      const tokenIssuedAt = (decodedToken as any).iat;
      if (!tokenIssuedAt || typeof tokenIssuedAt !== 'number') {
        logger.error({ userId: decodedToken.id, path: req.path }, "Token missing IAT in roleAuthorization");
        return handleError(res, 401, "Token format unacceptable for timestamp check.");
      }

      const userId = decodedToken.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isSuperAdmin: true, passwordChangedAt: true },
      });

      if (!user) {
        logger.warn({ userId, path: req.path }, "User associated with token not found in roleAuthorization");
        return handleError(res, 404, "User associated with token not found.");
      }

      if (user.passwordChangedAt && (tokenIssuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000))) {
        logger.warn({ userId, path: req.path, token_iat: tokenIssuedAt, pwd_changed: user.passwordChangedAt }, "Token invalidated due to password change in roleAuthorization");
        return handleError(res, 401, "Token invalidated due to password change.");
      }

      // Super admin bypasses school-specific and listed role checks.
      if (user.isSuperAdmin) {
        (req as any).user = user.id;
        return next();
      }

  
      if (roles.length > 0) {
        let schoolId: string | undefined = undefined;
        if (req.params && req.params.schoolId) schoolId = req.params.schoolId;
        else if (req.body && req.body.schoolId) schoolId = req.body.schoolId;
        else if (req.query && req.query.schoolId) schoolId = String(req.query.schoolId);

        if (!schoolId) {
          logger.warn({ userId, path: req.path, rolesChecked: roles }, "School ID missing for role-based action in roleAuthorization");
          return handleError(res, 400, "School ID is required for this action.");
        }

        const isAuthorizedBySchoolRole = await hasAnyRole(userId, schoolId, roles);
        if (!isAuthorizedBySchoolRole) {
          logger.warn({ userId, schoolId, rolesChecked: roles, path: req.path }, "User not authorized for action in school context in roleAuthorization");
          return handleError(res, 403, "You are not authorized to perform this action in this school.");
        }
      } else {
        logger.warn({ userId, path: req.path }, "Non-super_admin denied access due to empty roles array in roleAuthorization");
        return handleError(res, 403, "You are not authorized to perform this action.");
      }

      (req as any).user = user.id;
      next();
    } catch (error: any) {
      logger.error({ err: error, path: req.path }, "Error in roleAuthorization middleware");
      next(error);
    }
  };
};

/**
 * Middleware to validate a secure header key.
 * This can be used for protecting specific internal or privileged routes.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
export const secureHeaderValidation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const secureHeaderKey = process.env.EDUSTACK_SECURE_HEADER_KEY;
    if (
      !secureHeaderKey || 
      req.headers["x-header-secure-key"] !== secureHeaderKey 
    ) {
      logger.warn({path: req.path, ip: req.ip}, "Secure header validation failed: missing or invalid key.");
      return handleError(res, 400, "Secure header key is missing or invalid");
    }
    next();
  } catch (error: any) {
    logger.error({ err: error, path: req.path }, "Unexpected error in secureHeaderValidation");
    handleError(res, 500, "Internal server error during secure header validation.");
  }
};
