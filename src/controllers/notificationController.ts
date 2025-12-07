import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { NotificationCategory, NotificationType, Prisma } from "@prisma/client"; // Import enums for clarity
import { notifyUser } from "../utils/notification";
import logger from "../utils/logger";

/**
 * Represents a recipient for a notification or message.
 */
type Recipient = {
  id: string; // User ID
  email: string;
  role: "student" | "staff";
};

/**
 * Formats student data (including user and parent info) into Recipient objects.
 * Prioritizes parent's email for students.
 */
const _formatStudentsToRecipients = (
  students: any[]
): Recipient[] => // any[] for flexibility from various includes
  students.map((s) => ({
    id: s.user.id,
    email: s.parent?.email || s.user?.email || "",
    role: "student",
  }));

/**
 * Formats staff data into Recipient objects.
 */
const _formatStaffToRecipients = (
  staff: any[]
): Recipient[] => // any[] for flexibility
  staff.map((s) => ({
    id: s.userId, // Staff model has userId field linking to User model
    email: s.email || "",
    role: "staff",
  }));

/**
 * Fetches students by specific student IDs.
 */
const _getStudentsByIds = async (
  studentIds: string[]
): Promise<Recipient[]> => {
  if (!studentIds || studentIds.length === 0) return [];
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: {
      user: { select: { id: true, email: true } },
      parent: { select: { email: true } },
    },
  });
  return _formatStudentsToRecipients(students);
};

/**
 * Fetches students by class ID and optionally section ID.
 * Only includes currently enrolled students.
 */
const _getStudentsByClassOrSection = async (
  classId: string,
  sectionId?: string
): Promise<Recipient[]> => {
  const students = await prisma.student.findMany({
    where: {
      student_enrolled: {
        some: {
          classId: classId,
          ...(sectionId && { sectionId: sectionId }),
          status: "enrolled",
        },
      },
    },
    include: {
      user: { select: { id: true, email: true } },
      parent: { select: { email: true } },
    },
  });
  return _formatStudentsToRecipients(students);
};

/**
 * Fetches all students in a given school.
 */
const _getStudentsBySchool = async (schoolId: string): Promise<Recipient[]> => {
  const studentUserSchools = await prisma.userSchool.findMany({
    where: { schoolId: schoolId, role: "student" },
    select: { userId: true },
  });
  if (studentUserSchools.length === 0) return [];
  const students = await prisma.student.findMany({
    where: { userId: { in: studentUserSchools.map((sus) => sus.userId) } },
    include: {
      user: { select: { id: true, email: true } },
      parent: { select: { email: true } },
    },
  });
  return _formatStudentsToRecipients(students);
};

/**
 * Fetches staff by specific staff IDs.
 */
const _getStaffByIds = async (staffIds: string[]): Promise<Recipient[]> => {
  if (!staffIds || staffIds.length === 0) return [];
  const staff = await prisma.staff.findMany({
    where: { id: { in: staffIds } },
    select: { userId: true, email: true },
  });
  return _formatStaffToRecipients(staff);
};

/**
 * Fetches all staff (non-student roles) in a given school.
 */
const _getStaffBySchool = async (schoolId: string): Promise<Recipient[]> => {
  const staffUserSchools = await prisma.userSchool.findMany({
    where: { schoolId: schoolId, role: { not: "student" } },
    select: { userId: true },
  });
  if (staffUserSchools.length === 0) return [];
  const staff = await prisma.staff.findMany({
    where: { userId: { in: staffUserSchools.map((sus) => sus.userId) } },
    select: { userId: true, email: true },
  });
  return _formatStaffToRecipients(staff);
};

/**
 * Retrieves and formats a list of target recipients based on filter criteria.
 * Consolidates recipients from various targeting options (IDs, class, school).
 */
const _getTargetRecipients = async (filter: {
  studentIds?: string[];
  staffIds?: string[];
  classId?: string;
  sectionId?: string;
  schoolId?: string;
}): Promise<Recipient[]> => {
  const recipients: Recipient[] = [];

  if (filter.studentIds && filter.studentIds.length > 0) {
    recipients.push(...(await _getStudentsByIds(filter.studentIds)));
  }
  if (filter.classId) {
    recipients.push(
      ...(await _getStudentsByClassOrSection(filter.classId, filter.sectionId))
    );
  } else if (
    filter.schoolId &&
    !(filter.studentIds && filter.studentIds.length > 0)
  ) {
    // Fetch all students in school only if not already targeted by class or specific IDs
    recipients.push(...(await _getStudentsBySchool(filter.schoolId)));
  }

  if (filter.staffIds && filter.staffIds.length > 0) {
    recipients.push(...(await _getStaffByIds(filter.staffIds)));
  } else if (
    filter.schoolId &&
    !(filter.staffIds && filter.staffIds.length > 0) &&
    !(filter.studentIds && filter.studentIds.length > 0) &&
    !filter.classId
  ) {
    // Fetch all staff in school only if not targeted by specific IDs or other student criteria
    recipients.push(...(await _getStaffBySchool(filter.schoolId)));
  }

  const uniqueRecipientsMap = new Map<string, Recipient>();
  recipients.forEach((r) => {
    if (
      !uniqueRecipientsMap.has(r.id) ||
      (r.email && !uniqueRecipientsMap.get(r.id)?.email)
    ) {
      uniqueRecipientsMap.set(r.id, r);
    }
  });
  return Array.from(uniqueRecipientsMap.values());
};

/**
 * Dispatches notifications or schedules messages for a list of recipients.
 * Handles immediate sending via `notifyUser` or creation of `Scheduled_Message` records.
 */
const _dispatchMessages = async (
  recipientsToNotify: Recipient[],
  details: {
    title: string;
    message: string;
    category: NotificationCategory;
    channels: NotificationType[];
    scheduledAt?: Date;
    createdById: string;
  }
): Promise<void> => {
  const { title, message, category, channels, scheduledAt, createdById } =
    details;

  if (scheduledAt) {
    await prisma.scheduled_Message.createMany({
      data: recipientsToNotify.map((user) => ({
        userId: user.id,
        title,
        email: user.email || undefined,
        message,
        category,
        type:
          channels.includes(NotificationType.EMAIL) &&
          channels.includes(NotificationType.IN_APP)
            ? NotificationType.BOTH
            : channels[0],
        createdById,
        scheduledAt: new Date(scheduledAt),
      })),
    });
    logger.info(
      { count: recipientsToNotify.length, createdBy: createdById, scheduledAt },
      "Bulk messages scheduled."
    );
  } else {
    await Promise.all(
      recipientsToNotify.map((user) =>
        notifyUser({
          userId: user.id,
          email: user.email || "",
          title,
          message,
          category,
          channels,
        })
      )
    );
    logger.info(
      { count: recipientsToNotify.length, createdBy: createdById },
      "Bulk messages sent immediately."
    );
  }
};

/**
 * Interface defining the expected request body for sending bulk messages.
 */
export interface SendBulkMessageRequest {
  // Renamed for clarity
  recipients: {
    studentIds?: string[];
    staffIds?: string[];
    classId?: string;
    sectionId?: string;
    schoolId?: string;
  };
  title: string;
  message: string;
  category: NotificationCategory;
  channels: NotificationType[];
  scheduledAt?: Date;
}

/**
 * Sends bulk messages to specified recipients or schedules them for later delivery.
 * @route POST /api/notify
 */
export const sendBulkMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { recipients, title, message, category, channels, scheduledAt } =
      req.body as SendBulkMessageRequest;

    const usersToNotify = await _getTargetRecipients(recipients);

    if (usersToNotify.length === 0) {
      logger.warn(
        { recipientsFilter: recipients },
        "No recipients found for bulk message criteria."
      );
      res.status(400).json({
        success: false,
        message: "No recipients found matching the criteria.",
      });
      return;
    }

    const createdById = (req as any).user;

    await _dispatchMessages(usersToNotify, {
      title,
      message,
      category,
      channels,
      scheduledAt,
      createdById,
    });

    res.status(200).json({
      success: true,
      message: scheduledAt
        ? "Messages scheduled successfully!"
        : "Messages sent successfully!",
      recipientCount: usersToNotify.length,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Retrieves notifications for the authenticated user.
 * @route GET /api/notify
 */
export const getNotificationsForUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user;
    const { category, status, startDate, endDate } = req.query;

    if (!userId) {
      logger.warn(
        "Attempt to fetch notifications without user ID (unauthenticated)."
      );
      res
        .status(401)
        .json({ success: false, message: "User authentication required." });
      return;
    }

    const filters: Prisma.NotificationWhereInput = { userId };
    if (category) filters.category = category as NotificationCategory;
    if (status === "read") filters.isRead = true;
    else if (status === "unread") filters.isRead = false;

    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.gte = new Date(startDate as string);
      if (endDate) filters.createdAt.lte = new Date(endDate as string);
    }

    const notifications = await prisma.notification.findMany({
      where: filters,
      orderBy: { createdAt: "desc" },
    });
    logger.info(
      {
        userId,
        filterCount: Object.keys(filters).length - 1,
        resultCount: notifications.length,
      },
      "User notifications fetched."
    );

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully.",
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};
