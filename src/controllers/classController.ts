import { NextFunction, Request, Response } from "express";
import { classSchoolRequest } from "../types/requests";
import { handleError } from "../error/errorHandler";
import prisma from "../prisma";
import { paginateResults } from "../function/pagination";

// Create Class
export const createClass = async (
  req: Request<{}, {}, classSchoolRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { label, section, school_id, teacherId } = req.body;

    // Check if the class already exists for any provided school
    const existingClass = await prisma.classes.findFirst({
      where: {
        label,
        schoolId: { in: school_id },
      },
    });

    if (existingClass) {
      return handleError(
        res,
        "Class already exists for the provided school(s)",
        400
      );
    }

    // Deduplicate and validate school IDs
    const uniqueSchoolIds = [...new Set(school_id)];
    const schools = await prisma.school.findMany({
      where: { id: { in: uniqueSchoolIds } },
    });

    const invalidSchoolIds = uniqueSchoolIds.filter(
      (id) => !schools.some((school) => school.id === id)
    );

    if (invalidSchoolIds.length > 0) {
      return handleError(res, "Invalid school provided", 400);
    }

    // Create class and sections
    const result = await prisma.$transaction(async (tx) => {
      const createdClasses = await Promise.all(
        uniqueSchoolIds.map((schoolId) =>
          tx.classes.create({
            data: {
              label,
              schoolId,
            },
          })
        )
      );

      if (section) {
        const sections = section.split(",").map((sec) => sec.trim());
        await Promise.all(
          createdClasses.map((createdClass) =>
            tx.class_Section.createMany({
              data: sections.map((sec) => ({
                label: sec.toUpperCase(),
                classId: createdClass.id,
                teacherId: teacherId ? teacherId : undefined
              })),
            })
          )
        );
      }

      return createdClasses;
    });

    res.status(201).json({
      success: true,
      message: "Class created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Get All Classes
export const getAllClasses = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { schoolId, search } = req.query;

  try {
    const classes = await prisma.classes.findMany({
      where: {
        ...(schoolId && { schoolId: String(schoolId) }),
        ...(search && {
          label: {
            contains: search as string,
            mode: "insensitive",
          },
        }),
      },
      include: {
        sections: true,
        schools: {
          select: {
            name: true,
          },
        },
      },
      orderBy:{
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      message: "All classes retrieved successfully",
      data: paginateResults(
        classes,
        parseInt(req.query?.page as string, 10),
        parseInt(req.query?.limit as string, 10)
      ),
    });
  } catch (error) {
    next(error);
  }
};

// Get Class by ID
export const getClassById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const classId = req.params.id;

    const foundClass = await prisma.classes.findUnique({
      where: { id: classId },
      include: {
        sections: true,
        schools: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!foundClass) {
      return handleError(res, "Class not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Class retrieved successfully",
      data: foundClass,
    });
  } catch (error) {
    next(error);
  }
};

// Update Class
export const updateClass = async (
  req: Request<{ id: string }, {}, Partial<classSchoolRequest>>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: classId } = req.params;
    const { label, section, teacherId } = req.body;

    const existingClass = await prisma.classes.findUnique({
      where: { id: classId },
      include: { sections: true },
    });

    if (!existingClass) {
      return handleError(res, "Class not found", 404);
    }

    const updatedClass = await prisma.$transaction(async (tx) => {
      const updated = await tx.classes.update({
        where: { id: classId },
        data: { label: label || existingClass.label },
      });

      if (section) {
        const sections = section.split(",").map((sec) => sec.trim());
        await tx.class_Section.updateMany({
          where: {classId},
          data: sections.map((sec) => ({
            label: sec.toUpperCase(),
            classId,
            teacherId: teacherId ? teacherId : undefined
          })),
        });
      }

      return updated;
    });

    res.status(200).json({
      success: true,
      message: "Class updated successfully",
      data: updatedClass,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Class
export const deleteClass = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: classId } = req.params;

    const existingClass = await prisma.classes.findUnique({
      where: { id: classId },
    });

    if (!existingClass) {
      return handleError(res, "Class not found", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.class_Section.deleteMany({ where: { classId } });
      await tx.classes.delete({ where: { id: classId } });
    });

    res.status(200).json({
      success: true,
      message: "Class deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
