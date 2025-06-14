import { Request, Response } from "express";
import prisma from "../prisma";
import { NotificationOptions, notifyUser } from "../utils/notification";

type Recipient = {
  id: string;
  email: string;
  role: "student" | "staff";
};

const formatStudents = (students: any[]): Recipient[] =>
  students.map((s) => ({
    id: s.user.id,
    email: s.parent?.email || s.email,
    role: "student",
  }));

const formatStaff = (staff: any[]): Recipient[] =>
  staff.map((s) => ({
    id: s.userId,
    email: s.email,
    role: "staff",
  }));

const getTargetRecipients = async (filter: {
  studentIds?: string[];
  staffIds?: string[];
  classId?: string;
  sectionId?: string;
  schoolId?: string;
}): Promise<Recipient[]> => {
  let recipients: Recipient[] = [];

  // Get specific students
  if (filter.studentIds) {
    const students = await prisma.student.findMany({
      where: {
        id: { in: filter.studentIds },
        student_enrolled: { some: { status: "enrolled" } },
      },
      include: { user: true, parent: true },
    });
    recipients.push(...formatStudents(students));
  }

  // Get students by class or section
  if (filter.classId || filter.sectionId) {
    const students = await prisma.student.findMany({
      where: {
        student_enrolled: {
          some: {
            ...(filter.classId && { classId: filter.classId }),
            ...(filter.sectionId && { sectionId: filter.sectionId }),
            status: "enrolled",
          },
        },
      },
      include: { user: true, parent: true },
    });
    recipients.push(...formatStudents(students));
  }

  // Get students in school
  if (filter.schoolId) {
    const studentLinks = await prisma.userSchool.findMany({
      where: {
        schoolId: filter.schoolId,
        role: "student",
      },
      select: { userId: true },
    });

    if (studentLinks.length > 0) {
      const enrolledStudents = await prisma.student.findMany({
        where: {
          userId: { in: studentLinks.map((s) => s.userId) },
          student_enrolled: { some: { status: "enrolled" } },
        },
        include: { user: true, parent: true },
      });
      recipients.push(...formatStudents(enrolledStudents));
    }
  }

  // Get staff by ID
  if (filter.staffIds) {
    const staff = await prisma.staff.findMany({
      where: {
        id: { in: filter.staffIds },
      },
      select: { userId: true, email: true },
    });
    recipients.push(...formatStaff(staff));
  }

  // Optional: Remove duplicates by email
  const uniqueRecipients = Array.from(
    new Map(recipients.map((r) => [r.email, r])).values()
  );

  return uniqueRecipients;
};

export interface SendBulkMessage {
  recipients: {
    studentIds?: string[];
    classId?: string;
    schoolId?: string;
  };
  title: string;
  message: string;
  category: NotificationOptions["category"];
  channels: ("EMAIL" | "IN_APP" | "BOTH")[];
  scheduledAt?: Date;
}

export const sendBulkMessages = async (req: Request, res: Response) => {
  try {
    const { recipients, title, message, category, channels, scheduledAt } =
      req.body as SendBulkMessage;

    const users = await getTargetRecipients(recipients);

    const studentRecipients = users.filter(
      (u) => u.role === "student" && u.email
    );
    const staffRecipients = users.filter((u) => u.role === "staff" && u.email);

    // Helper to schedule or send
    const processRecipients = async (
      group: typeof users,
      role: "student" | "staff"
    ) => {
      if (scheduledAt) {
        await prisma.scheduled_Message.createMany({
          data: group.map((user) => ({
            userId: user.id,
            title: `[${role.toUpperCase()}] ${title}`,
            email: user.email!,
            message,
            category,
            type: channels.length > 1 ? "BOTH" : channels[0],
            createdById: (req as any).user,
            scheduledAt,
          })),
        });
      } else {
        await Promise.all(
          group.map((user) =>
            notifyUser({
              userId: user.id,
              email: user.email!,
              title: `[${role.toUpperCase()}] ${title}`,
              message,
              category,
              channels,
            })
          )
        );
      }
    };

    // Process each group
    await processRecipients(studentRecipients, "student");
    await processRecipients(staffRecipients, "staff");

    res.status(200).json({
      success: true,
      message: scheduledAt
        ? "Messages scheduled successfully!"
        : "Messages sent successfully!",
    });
    return;
  } catch (error: any) {
    console.error("Error in sendBulkMessages:", error.message);
    res.status(500).json({
      success: false,
      message: "An error occurred while sending messages",
    });
    return;
  }
};

export const getNotificationsForUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user;
    const { category, status, startDate, endDate } = req.query;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const filters: any = {
      userId,
    };

    if (category) {
      filters.category = category;
    }

    if (status === "read") {
      filters.isRead = true;
    } else if (status === "unread") {
      filters.isRead = false;
    }

    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.gte = new Date(startDate as string);
      if (endDate) filters.createdAt.lte = new Date(endDate as string);
    }

    const notifications = await prisma.notification.findMany({
      where: filters,
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications,
    });
    return;
  } catch (error) {
    console.error("Error fetching notifications for user:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching notifications",
    });
    return;
  }
};
