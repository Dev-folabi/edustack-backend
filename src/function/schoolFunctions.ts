import { Response } from "express";
import { handleError } from "../error/errorHandler";
import prisma from "../prisma";

export const validateSchool = async (schoolId: string) => {
  const existingSchool = await prisma.school.findUnique({
    where: { id: schoolId },
  });

  if (existingSchool) {
    return existingSchool;
  }

  return null;
};

// Helper to validate user-school relationship
export const validateUserSchool = async (userId: string, schoolId: string) => {
  return prisma.userSchool.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
  });
};

export const findStudent = async (studentId: string, res: Response) => {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student) return handleError(res, "Student not found", 404);
  return student;
};

export const findClassWithSections = async (classId: string, res: Response) => {
  const classInfo = await prisma.classes.findUnique({
    where: { id: classId },
    include: { sections: true },
  });
  if (!classInfo) return handleError(res, "Class not found", 404);
  return classInfo;
};

export const findActiveSession = async (res: Response) => {
  const session = await prisma.session.findFirst({
    where: { isActive: true },
    include: { terms: true },
  });
  if (!session) return handleError(res, "No active session found", 400);
  return session;
};

export const validateSection = async (classId: string, sectionId: string) => {
  return prisma.class_Section.findFirst({
    where: { id: sectionId, classId },
  });
};