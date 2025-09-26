import { NextFunction, Request, Response } from "express";
import prisma from "../../prisma";
import { handleError } from "../../error/errorHandler";
import logger from "../../utils/logger";

/**
 * Generate a detailed report card for a single student for a specific term.
 * @route GET /api/reports/student-term-report
 */
export const generateStudentTermReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId, termId, sessionId } = req.query;

    if (!studentId || !termId || !sessionId) {
      return handleError(
        res,
        "studentId, termId, and sessionId are required query parameters.",
        400
      );
    }

    // 1. Fetch primary data: Student and their enrollment for the specified term
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId: studentId as string,
        termId: termId as string,
        sessionId: sessionId as string,
      },
      include: {
        student: true,
        class: { include: { school: true } },
        section: true,
        term: true,
        session: true,
      },
    });

    if (!enrollment) {
      return handleError(
        res,
        "Student enrollment for the specified term not found.",
        404
      );
    }

    const { student, class: studentClass, section, term, session } = enrollment;
    const { school } = studentClass;

    // 2. Fetch all supplementary data in parallel
    const [
      results,
      psychomotorAssessments,
      gradeCriteria,
      attendanceCounts,
      classSize,
      schoolBills,
      schoolDays,
    ] = await Promise.all([
      // Academic results
      prisma.result.findMany({
        where: {
          studentId: studentId as string,
          examPaper: {
            exam: { termId: termId as string, sessionId: sessionId as string },
          },
          isPublished: true,
        },
        include: {
          examPaper: {
            include: {
              subject: true,
              exam: { select: { title: true, startDate: true } },
            },
          },
        },
        orderBy: { examPaper: { exam: { startDate: "asc" } } },
      }),
      // Affective traits / Psychomotor skills
      prisma.psychomotorSkill.findMany({
        where: { schoolId: school.id },
        include: {
          assessments: {
            where: {
              studentId: studentId as string,
              termId: termId as string,
              sessionId: sessionId as string,
            },
          },
        },
      }),
      // School's grading criteria
      prisma.gradeCriteria.findMany({ where: { schoolId: school.id } }),
      // Student's attendance record for the term
      prisma.attendance.groupBy({
        by: ["status"],
        where: {
          studentId: studentId as string,
          date: { gte: term.start_date, lte: term.end_date },
        },
        _count: { status: true },
      }),
      // Total number of students in the class
      prisma.studentEnrollment.count({
        where: {
          classId: studentClass.id,
          sectionId: section.id,
          sessionId: sessionId as string,
        },
      }),
      // Student's financial records for the term
      prisma.studentInvoice.findMany({
        where: {
          studentId: studentId as string,
          invoice: { termId: termId as string, sessionId: sessionId as string },
        },
        include: { invoice: { include: { invoiceItems: true } } },
      }),
      // Total number of school days in the term
      prisma.attendance.count({
        where: {
          sectionId: section.id,
          date: { gte: term.start_date, lte: term.end_date },
        },
        distinct: ["date"],
      }),
    ]);

    // 3. Process the fetched data

    // Process academic results
    const subjectsMap = new Map();
    let grandTotalMarksObtained = 0;
    let grandTotalMaxMarks = 0;

    results.forEach((result) => {
      const { subject, exam, maxMarks } = result.examPaper;
      if (!subjectsMap.has(subject.id)) {
        subjectsMap.set(subject.id, {
          name: subject.name,
          scores: [],
          total: 0,
          max: 0,
        });
      }
      const subjectData = subjectsMap.get(subject.id);
      subjectData.scores.push({
        title: exam.title,
        score: result.marksObtained,
      });
      subjectData.total += result.marksObtained;
      subjectData.max += maxMarks;
      grandTotalMarksObtained += result.marksObtained;
      grandTotalMaxMarks += maxMarks;
    });

    const academicResults = Array.from(subjectsMap.values()).map(
      (subjectData) => {
        const percentage =
          subjectData.max > 0
            ? (subjectData.total / subjectData.max) * 100
            : 0;
        const gradeInfo = gradeCriteria.find(
          (g) => percentage >= g.minScore && percentage <= g.maxScore
        );
        return {
          ...subjectData,
          percentage: parseFloat(percentage.toFixed(2)),
          grade: gradeInfo ? gradeInfo.name : "N/A",
          remark: gradeInfo ? gradeInfo.remark : "N/A",
        };
      }
    );

    const overallPercentage =
      grandTotalMaxMarks > 0
        ? (grandTotalMarksObtained / grandTotalMaxMarks) * 100
        : 0;
    const overallGrade = gradeCriteria.find(
      (g) =>
        overallPercentage >= g.minScore && overallPercentage <= g.maxScore
    );

    // Process attendance
    const attendance = {
      timesSchoolOpened: schoolDays,
      timesPresent:
        attendanceCounts.find((a) => a.status === "PRESENT")?._count.status ||
        0,
      timesAbsent:
        attendanceCounts.find((a) => a.status === "ABSENT")?._count.status || 0,
    };

    // 4. Construct the final report card object
    const reportCard = {
      schoolInfo: {
        name: school.name,
        address: school.address,
        phone: school.phone,
        email: school.email,
        motto: school.motto,
      },
      studentInfo: {
        name: student.name,
        admissionNumber: student.admission_number,
        class: studentClass.name,
        section: section.name,
        gender: student.gender,
        dob: student.dob,
      },
      termInfo: {
        session: session.name,
        term: term.name,
        timesOpened: attendance.timesSchoolOpened,
        closingDate: term.end_date,
        resumptionDate: term.resumptionDate,
        classSize,
      },
      performance: {
        academic: academicResults,
        summary: {
          totalMarks: grandTotalMarksObtained,
          maxMarks: grandTotalMaxMarks,
          percentage: parseFloat(overallPercentage.toFixed(2)),
          grade: overallGrade ? overallGrade.name : "N/A",
        },
      },
      attendance: {
        present: attendance.timesPresent,
        absent: attendance.timesAbsent,
      },
      affectiveTraits: psychomotorAssessments.map((skill) => ({
        name: skill.name,
        rating:
          skill.assessments.length > 0 ? skill.assessments[0].rating : null,
      })),
      schoolBills: schoolBills.flatMap((sb) =>
        sb.invoice.invoiceItems.map((item) => ({
          name: item.description,
          amount: item.amount,
        }))
      ),
      remarks: {
        teacher: enrollment.classTeacherRemark,
        principal: enrollment.schoolHeadRemark,
      },
    };

    res.status(200).json({
      success: true,
      message: "Student term report generated successfully.",
      data: reportCard,
    });
  } catch (error) {
    logger.error(error, "Failed to generate student term report");
    next(error);
  }
};