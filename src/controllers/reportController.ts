import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { handleError } from "../error/errorHandler";
import logger from "../utils/logger";

/**
 * Generate a detailed report card for a single student for a specific term.
 * @route GET /api/reports/student-term-report
 */
export const generateStudentTermReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { studentId, termId, sessionId } = req.query;

        if (!studentId || !termId || !sessionId) {
            return handleError(res, "studentId, termId, and sessionId are required query parameters.", 400);
        }

        const student = await prisma.student.findUnique({ where: { id: studentId as string } });
        const enrollment = await prisma.studentEnrollment.findFirst({
            where: { studentId: studentId as string, termId: termId as string, sessionId: sessionId as string },
            include: { class: { select: { name: true, schoolId: true } }, section: { select: { name: true } } }
        });

        if (!student || !enrollment) {
            return handleError(res, "Student or their enrollment for the specified term not found.", 404);
        }

        const schoolId = enrollment.class.schoolId;

        const [results, psychomotorAssessments, gradeCriteria] = await Promise.all([
            prisma.result.findMany({
                where: {
                    studentId: studentId as string,
                    examPaper: { exam: { termId: termId as string, sessionId: sessionId as string } },
                    isPublished: true
                },
                include: {
                    examPaper: { include: { subject: true } }
                }
            }),
            prisma.psychomotorSkill.findMany({
                where: { schoolId },
                include: {
                    assessments: {
                        where: { studentId: studentId as string, termId: termId as string, sessionId: sessionId as string }
                    }
                }
            }),
            prisma.gradeCriteria.findMany({ where: { schoolId } })
        ]);

        let totalMarksObtained = 0;
        let totalMaxMarks = 0;

        const processedResults = results.map(result => {
            totalMarksObtained += result.marksObtained;
            totalMaxMarks += result.examPaper.maxMarks;
            const percentage = result.examPaper.maxMarks > 0 ? (result.marksObtained / result.examPaper.maxMarks) * 100 : 0;
            const grade = gradeCriteria.find(g => percentage >= g.minScore && percentage <= g.maxScore);

            return {
                subject: result.examPaper.subject.name,
                marksObtained: result.marksObtained,
                maxMarks: result.examPaper.maxMarks,
                percentage: parseFloat(percentage.toFixed(2)),
                grade: grade ? grade.name : "N/A",
                remark: result.teacherRemark
            };
        });

        const overallPercentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks) * 100 : 0;
        const overallGrade = gradeCriteria.find(g => overallPercentage >= g.minScore && overallPercentage <= g.maxScore);

        const reportCard = {
            studentInfo: {
                id: student.id,
                name: student.name,
                admissionNumber: student.admission_number,
            },
            academicInfo: {
                class: enrollment.class.name,
                section: enrollment.section.name,
            },
            results: processedResults,
            summary: {
                totalMarksObtained,
                totalMaxMarks,
                overallPercentage: parseFloat(overallPercentage.toFixed(2)),
                overallGrade: overallGrade ? overallGrade.name : "N/A",
            },
            psychomotor: psychomotorAssessments.map(skill => ({
                name: skill.name,
                rating: skill.assessments.length > 0 ? skill.assessments[0].rating : null
            })),
            remarks: {
                classTeacher: enrollment.classTeacherRemark,
                schoolHead: enrollment.schoolHeadRemark
            }
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
