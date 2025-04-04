import { Request, Response } from "express";
import prisma from "../prisma";
import { NotificationOptions, notifyUser } from "../utils/mail";


const getTargetRecipients = async (filter: {
  studentIds?: string[];
  staffIds?: string[];
  classId?: string;
  schoolId?: string;
}) => {

  if (filter.studentIds) {
    const existingStudents = await prisma.studentEnrollment.findMany({
      where: { studentId: { in: filter.studentIds }, status: "enrolled" },
      select: { studentId: true },
    });
    const students = await prisma.student.findMany({
      where: {id: {in: existingStudents.map(s => s.studentId)}},
      select: { id: true, parent: true, email: true }
    })

    return students.map(s => ({ id: s.id, email: s.parent ? s.parent.email : s.email }));
  }

  if (filter.classId) {
    const existingStudents = await prisma.studentEnrollment.findMany({
      where: { OR: [{ classId: filter.classId }, { sectionId: filter.classId }], status: "enrolled" },
      select: { studentId: true },
    });
    const students = await prisma.student.findMany({
      where: {id: {in: existingStudents.map(s => s.studentId)}},
      select: { id: true, parent: true, email: true }
    })

    return students.map(s => ({ id: s.id, email: s.parent ? s.parent.email : s.email }));
  }

  if (filter.schoolId) {
    const existingStudents = await prisma.userSchool.findMany({
      where: { schoolId: filter.schoolId, role: "student" },
      select: { user: true },
    });

    const studentIds = existingStudents.map(s => s.user.id);
    const enrolledStudents = await prisma.studentEnrollment.findMany({
      where: { studentId: { in: studentIds }, status: "enrolled" },
      select: { studentId: true },
    });

    const enrolledStudentIds = enrolledStudents.map(s => s.studentId);
    const students = await prisma.student.findMany({
      where: { id: { in: enrolledStudentIds } },
      select: { id: true, parent: true, email: true },
    });

    return students.map(s => ({ id: s.id, email: s.parent ? s.parent.email : s.email }));
  }

  return [];
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
  scheduledAt? : Date;
}


export const sendBulkMessages = async (req: Request, res: Response) => {
  const { recipients, title, message, category, channels, scheduledAt } = req.body as SendBulkMessage

  const users = await getTargetRecipients(recipients)

  if(!scheduledAt){
    for (const user of users) {
      await notifyUser({
        userId: user.id,
        email: user.email!,
        title,
        message,
        category,
        channels,
    });

  }

  return res.status(200).json({ message: "Messages sent successfully!" });
};


export const getNotificationsForUser = async (userId: string) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};
