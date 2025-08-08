import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import logger from "../utils/logger";

/**
 * Custom middleware to validate if a user with the given email or username already exists during signup.
 * This check is performed before attempting to create a new user.
 * If a user exists, it sends a 400 response. Otherwise, it calls `next()`.
 *
 * @param req - Express request object, expected to contain `email` and `username` in `req.body`.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
export const signUpvalidate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, username } = req.body;

    // Check for existing user by either email or username.
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email } },
          { username: { equals: username } }
        ]
      },
      select: { id: true }
    });

    if (existingUser) {
      logger.warn({ email, username, path: req.path }, "Signup attempt with existing email or username.");
      res.status(400).json({ success: false, message: "User with this email or username already exists." });
      return;
    }

    next();
  } catch (error: any) {
    logger.error({ err: error, path: req.path }, "Error in signUpvalidate middleware");
    next(error);
  }
};
