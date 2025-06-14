import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { getIdFromToken } from "../function/token";
import { UserRole as PrismaUserRole } from "@prisma/client";

export const roleAuthorization = (roles: PrismaUserRole[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = getIdFromToken(req);
      if (!userId) {
        return handleError(res, 400, "Invalid token provided");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isSuperAdmin: true },
      });

      if (!user) {
        return handleError(res, 404, "User not found");
      }

      const isAuthorized =
        user.isSuperAdmin || (await hasAnyRole(userId, roles));
      if (!isAuthorized) {
        return handleError(
          res,
          403,
          "You are not authorized to perform this action"
        );
      }

      (req as any).user = user.id;
      next();
    } catch (error: any) {
      console.error("Error in roleAuthorization:", error.message);
      next(error);
    }
  };
};

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getIdFromToken(req);
    if (!userId) {
      return handleError(res, 400, "Invalid token provided");
    }

    (req as any).user = userId;
    next();
  } catch (error: any) {
    console.error("Error in tokenAuthorization:", error.message);
    next(error);
  }
};

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
      return handleError(res, 400, "Secure header key is missing or invalid");
    }

    next();
  } catch (error: any) {
    console.error("Error in secureHeaderValidation:", error.message);
    handleError(res, 500, error.message);
  }
};

const hasAnyRole = async (userId: string, roles: PrismaUserRole[]) => {
  try {
    const userRole = await prisma.userSchool.findFirst({
      where: { userId },
    });

    return (userRole?.role && roles.includes(userRole.role)) || false;
  } catch (error) {
    console.error("Error in hasAnyRole:", error);
    throw error;
  }
};

const handleError = (res: Response, status: number, message: string) => {
  res.status(status).json({ success: false, message });
};
