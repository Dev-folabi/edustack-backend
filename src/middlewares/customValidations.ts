import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";

export const signUpvalidate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, username } = req.body;

    // Check for existing user by email or username
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email } },
          { username: { equals: username } }
        ]
      }
    });

    if (existingUser) {
      res.status(400).json({ success: false, message: "User already exists" });
      return;
    }

    next();
  } catch (error: any) {
    console.error("Error in signUpvalidate middleware:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
