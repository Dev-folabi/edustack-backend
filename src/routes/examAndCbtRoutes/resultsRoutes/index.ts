import express from "express";
import {
  verifyToken,
  roleAuthorization,
} from "../../../middlewares/authorization";
import {
  addManualMarks,
  getEssayResponsesForGrading,
  gradeEssayResponse,
  finalizeCbtResults,
  publishResults,
  addTermRemarks,
} from "../../../controllers/examAndCBT/resultsController";
import { getStudentExamAttempt } from "../../../controllers/examAndCBT/cbtController";
import {
  TEACHER_ROLES,
  STUDENT_ROLES,
  ADMIN_ROLES,
} from "../../../config/constants";

const router = express.Router();

router.use(verifyToken);

// Route for manual mark entry for paper-based tests
router.post(
  "/manual-entry",
  roleAuthorization([...TEACHER_ROLES]),
  addManualMarks
);

// Get a student's exam attempt details
router.get(
  "/attempts/:attemptId/student/:studentId",
  roleAuthorization([...TEACHER_ROLES, ...STUDENT_ROLES, ...ADMIN_ROLES]),
  getStudentExamAttempt
);

// Routes for grading essays
router.get(
  "/essays-for-grading/:examPaperId",
  roleAuthorization([...TEACHER_ROLES]),
  getEssayResponsesForGrading
);
router.post(
  "/grade-essay/:responseId",
  roleAuthorization([...TEACHER_ROLES]),
  gradeEssayResponse
);

// Route to finalize CBT results after grading
router.post(
  "/finalize-cbt/:examPaperId",
  roleAuthorization([...TEACHER_ROLES]),
  finalizeCbtResults
);

// Route to publish/unpublish results
router.post(
  "/publish/:examPaperId",
  roleAuthorization([...TEACHER_ROLES]),
  publishResults
);

// Route to add term-level remarks for a student
router.post(
  "/term-remarks",
  roleAuthorization([...TEACHER_ROLES]),
  addTermRemarks
);

export default router;
