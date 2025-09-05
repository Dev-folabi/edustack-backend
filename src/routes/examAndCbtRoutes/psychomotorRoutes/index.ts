import express from "express";
import { TEACHER_ROLES } from "../../../config/constants";
import {
  roleAuthorization,
  verifyToken,
} from "../../../middlewares/authorization";
import { savePsychomotorAssessments } from "../../../controllers/examAndCBT/psychomotorController";

const router = express.Router();

// Psychomotor assessment submission is for teachers/admins
router.use(verifyToken);
router.use(roleAuthorization([...TEACHER_ROLES]));

router.post("/assessments", savePsychomotorAssessments);

export default router;
