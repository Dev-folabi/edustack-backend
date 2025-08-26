import express from "express";
import { verifyToken, roleAuthorization } from "../../middlewares/authorization";
import {
    addManualMarks,
    getEssayResponsesForGrading,
    gradeEssayResponse,
    finalizeCbtResults,
    publishResults,
    addTermRemarks
} from "../../controllers/resultsController";
import { TEACHER_ROLES } from "../../config/constants";

const router = express.Router();

// All results management routes are for teachers/admins
router.use(verifyToken);
router.use(roleAuthorization([...TEACHER_ROLES]));

// Route for manual mark entry for paper-based tests
router.post("/manual-entry", addManualMarks);

// Routes for grading essays
router.get("/essays-for-grading/:examPaperId", getEssayResponsesForGrading);
router.post("/grade-essay/:responseId", gradeEssayResponse);

// Route to finalize CBT results after grading
router.post("/finalize-cbt/:examPaperId", finalizeCbtResults);

// Route to publish/unpublish results
router.post("/publish/:examPaperId", publishResults);

// Route to add term-level remarks for a student
router.post("/term-remarks", addTermRemarks);

export default router;
