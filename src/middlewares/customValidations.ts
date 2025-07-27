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
    // Note: Prisma's `findFirst` is suitable here. If both email and username must be unique
    // across all users, the schema should enforce this with @unique constraints.
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email } }, // Ensure case-insensitivity if needed via Prisma's `mode` option
          { username: { equals: username } } // Username uniqueness might also be case-insensitive depending on DB collation / Prisma settings
        ]
      },
      select: { id: true } // Only select ID for existence check
    });

    if (existingUser) {
      // User with the same email or username already exists.
      // Sending a 400 (Bad Request) or 409 (Conflict) are common choices.
      // The message can be made more specific if desired (e.g., "Email already in use" or "Username taken").
      logger.warn({ email, username, path: req.path }, "Signup attempt with existing email or username.");
      res.status(400).json({ success: false, message: "User with this email or username already exists." });
      return;
    }

    next(); // No existing user found, proceed to the next middleware or controller.
  } catch (error: any) {
    logger.error({ err: error, email, username, path: req.path }, "Error in signUpvalidate middleware");
    next(error); // Pass unexpected errors to the global error handler.
  }
};
