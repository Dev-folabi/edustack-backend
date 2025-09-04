import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import logger from "../utils/logger";
import { handleError } from "../error/errorHandler";
import bcrypt from "bcrypt";
import { UserRole } from "@prisma/client";

// Get system settings
export const getSystemSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let settings = await prisma.systemSettings.findFirst();

    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.systemSettings.create({
        data: {},
      });
    }

    // Remove sensitive fields from response
    const {
      enableSmsNotifications,
      sessionTimeout,
      maxLoginAttempts,
      passwordMinLength,
      requireStrongPassword,
      maxFileSize,
      allowedFileTypes,
      ...safeSettings
    } = settings;

    res.status(200).json({
      success: true,
      message: "System settings retrieved successfully",
      data: safeSettings,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching system settings");
    next(error);
  }
};

// Update system settings
export const updateSystemSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    const { id, createdAt, updatedAt, ...allowedUpdates } = updateData;

    let settings = await prisma.systemSettings.findFirst();

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: allowedUpdates,
      });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: allowedUpdates,
      });
    }

    // Log the update
    await prisma.systemLog.create({
      data: {
        level: "INFO",
        category: "SYSTEM",
        message: "System settings updated",
        details: { updatedFields: Object.keys(allowedUpdates) },
      },
    });

    // Remove sensitive fields from response
    const {
      enableSmsNotifications,
      sessionTimeout,
      maxLoginAttempts,
      passwordMinLength,
      requireStrongPassword,
      maxFileSize,
      allowedFileTypes,
      ...safeSettings
    } = settings;

    res.status(200).json({
      success: true,
      message: "System settings updated successfully",
      data: safeSettings,
    });
  } catch (error) {
    logger.error({ error }, "Error updating system settings");
    next(error);
  }
};

// Check if system is onboarded
export const checkSystemOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const settings = await prisma.systemSettings.findFirst({
      select: {
        isOnboarded: true,
        onboardedAt: true,
        appName: true,
        appVersion: true,
      },
    });

    const onboardingStatus = await prisma.onboardingStatus.findFirst();

    res.status(200).json({
      success: true,
      message: "System onboarding status checked",
      data: {
        isOnboarded: settings?.isOnboarded || false,
        onboardedAt: settings?.onboardedAt,
        appName: settings?.appName || "EduStack",
        appVersion: settings?.appVersion || "1.0.0",
        onboardingProgress: onboardingStatus?.completionPercentage || 0,
        currentStep: onboardingStatus?.currentStep || 1,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error checking system onboarding");
    next(error);
  }
};
