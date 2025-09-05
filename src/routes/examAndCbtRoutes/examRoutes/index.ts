import express from "express";
import {
  verifyToken,
  roleAuthorization,
} from "../../../middlewares/authorization";
import {
  getGlobalExamSettings,
  upsertGlobalExamSettings,
  getGradeCriteria,
  createGradeCriteria,
  updateGradeCriteria,
  deleteGradeCriteria,
  getPsychomotorSkills,
  createPsychomotorSkill,
  updatePsychomotorSkill,
  deletePsychomotorSkill,
} from "../../../controllers/examAndCBT/examSettingsController";
import { ADMIN_ROLES } from "../../../config/constants";

const router = express.Router();

// Middleware to protect all routes in this file
router.use(verifyToken);

// Global Settings Routes
router.get("/global", getGlobalExamSettings);
router.post(
  "/global",
  roleAuthorization([...ADMIN_ROLES]),
  upsertGlobalExamSettings
);

// Grade Criteria Routes
router.get("/grades", getGradeCriteria);
router.post(
  "/grades",
  roleAuthorization([...ADMIN_ROLES]),
  createGradeCriteria
);
router.put(
  "/grades/:id",
  roleAuthorization([...ADMIN_ROLES]),
  updateGradeCriteria
);
router.delete(
  "/grades/:id",
  roleAuthorization([...ADMIN_ROLES]),
  deleteGradeCriteria
);

// Psychomotor Skills Routes
router.get("/psychomotor", getPsychomotorSkills);
router.post(
  "/psychomotor",
  roleAuthorization([...ADMIN_ROLES]),
  createPsychomotorSkill
);
router.put(
  "/psychomotor/:id",
  roleAuthorization([...ADMIN_ROLES]),
  updatePsychomotorSkill
);
router.delete(
  "/psychomotor/:id",
  roleAuthorization([...ADMIN_ROLES]),
  deletePsychomotorSkill
);

export default router;
