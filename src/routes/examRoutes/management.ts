import express from "express";
import { verifyToken, roleAuthorization } from "../../middlewares/authorization";
import {
    createExam,
    getExams,
    getExamById,
    updateExam,
    deleteExam,
    addExamPaper,
    updateExamPaper,
    deleteExamPaper,
    getExamTimetable
} from "../../controllers/examController";
import { TEACHER_ROLES } from "../../config/constants";

const router = express.Router();

// Middleware to protect all routes
router.use(verifyToken);

// Exam Routes
router.post(
    "/",
    roleAuthorization([...TEACHER_ROLES]),
    createExam
);

router.get("/", getExams); // Students and parents might also need this, handled in controller/service layer

router.get("/timetable/view", getExamTimetable);

router.get("/:id", getExamById);

router.put(
    "/:id",
    roleAuthorization([...TEACHER_ROLES]),
    updateExam
);

router.delete(
    "/:id",
    roleAuthorization([...TEACHER_ROLES]),
    deleteExam
);

// Exam Paper Routes (nested under an exam)
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
