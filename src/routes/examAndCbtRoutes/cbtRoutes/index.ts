import express from "express";
import {
  verifyToken,
  roleAuthorization,
} from "../../../middlewares/authorization";
import {
  startExamAttempt,
  saveExamResponse,
  submitExamAttempt,
} from "../../../controllers/examAndCBT/cbtController";
import { STUDENT_ROLES } from "../../../config/constants";

const router = express.Router();

// All CBT routes are for students
router.use(verifyToken);
router.use(roleAuthorization([...STUDENT_ROLES]));

// Route to start an exam attempt
router.post("/attempts/start", startExamAttempt);

// Route to save a response to a question
router.post("/attempts/:attemptId/responses", saveExamResponse);

// Route to submit an exam
router.post("/attempts/:attemptId/submit", submitExamAttempt);

export default router;
