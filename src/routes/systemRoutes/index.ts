import express from "express";
import {
  verifyToken,
  roleAuthorization,
} from "../../middlewares/authorization";
import {
  getSystemSettings,
  updateSystemSettings,
  checkSystemOnboarding,
} from "../../controllers/systemController";
import { validateSystemSettings } from "../../middlewares/Validators";
import { ADMIN_ROLES } from "../../config/constants";

const router = express.Router();

// Public routes (no authentication required)
router.get("/onboarding/check", checkSystemOnboarding);

// Protected routes (authentication required)
router.use(verifyToken);

// System Settings Routes (Admin only)
router.get("/settings", roleAuthorization([...ADMIN_ROLES]), getSystemSettings);
router.put(
  "/settings",
  roleAuthorization([...ADMIN_ROLES]),
  validateSystemSettings,
  updateSystemSettings
);

export default router;
