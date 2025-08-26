import express from "express";
import { verifyToken, roleAuthorization } from "../../middlewares/authorization";
import { savePsychomotorAssessments } from "../../controllers/psychomotorController";
import { TEACHER_ROLES } from "../../config/constants";

const router = express.Router();

// Psychomotor assessment submission is for teachers/admins
router.use(verifyToken);
router.use(roleAuthorization([...TEACHER_ROLES]));

router.post("/assessments", savePsychomotorAssessments);

export default router;
