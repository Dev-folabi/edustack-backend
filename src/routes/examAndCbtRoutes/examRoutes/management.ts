import express from "express";
import {
  verifyToken,
  roleAuthorization,
} from "../../../middlewares/authorization";
import {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  addExamPaper,
  updateExamPaper,
  deleteExamPaper,
  getExamTimetable,
  getStudentExams,
  getExamPaperById,
  getExamPapersByTermAndSession,
  getAllExamPapers
} from "../../../controllers/examAndCBT/examController";
import {
  PARENT_ROLES,
  STUDENT_ROLES,
  TEACHER_ROLES,
} from "../../../config/constants";

const router = express.Router();

// Middleware to protect all routes
router.use(verifyToken);

// Exam Routes
router.post("/", roleAuthorization([...TEACHER_ROLES]), createExam);

router.get("/student/:studentId", getStudentExams);

router.get("/", getExams);

router.get(
  "/papers/by-term-session",
  roleAuthorization([...TEACHER_ROLES]),
  getExamPapersByTermAndSession
);

router.get("/timetable/view", getExamTimetable);

router.get("/:id", getExamById);

router.put("/:id", roleAuthorization([...TEACHER_ROLES]), updateExam);

router.delete("/:id", roleAuthorization([...TEACHER_ROLES]), deleteExam);

// Exam Paper Routes (nested under an exam)
router.get(
  "/exam/papers/:paperId",
  roleAuthorization([...STUDENT_ROLES, ...TEACHER_ROLES]),
  getExamPaperById
);

router.get(
  "/exam/papers",
  roleAuthorization([...TEACHER_ROLES]),
  getAllExamPapers
);

router.post(
  "/:examId/papers",
  roleAuthorization([...TEACHER_ROLES]),
  addExamPaper
);

router.put(
  "/:examId/papers/:paperId",
  roleAuthorization([...TEACHER_ROLES]),
  updateExamPaper
);

router.delete(
  "/:examId/papers/:paperId",
  roleAuthorization([...TEACHER_ROLES]),
  deleteExamPaper
);

export default router;
