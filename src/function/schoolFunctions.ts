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

export const checkIfAdminAction = async (reqToken: string, schoolIds?: string[]) => {
  let isAdminAction = false;
  if (!reqToken) return false;

  const user = await prisma.user.findUnique({
    where: { id: reqToken },
    include: { userSchools: true },
  });

  if (!user) return false;

  const isAdminUser =
    user.isSuperAdmin ||
    user.userSchools.some((school) => school.role.toLowerCase().includes("admin"));

  if (!isAdminUser) return false;

  if ( !user.isSuperAdmin && schoolIds && schoolIds.length > 0) {

    const userSchoolIds = user.userSchools.map((s) => s.schoolId);
    const hasAllSchools = schoolIds.every((id) => userSchoolIds.includes(id));

    if (!hasAllSchools) return false;
  }

  isAdminAction = true;
  return isAdminAction;
};

