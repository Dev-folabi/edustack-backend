import express from "express";

import { roleAuthorization, verifyToken } from "../../middlewares/authorization";
import { staffSignUp } from "../../controllers/authController";
import {
  deleteStaff,
  getStaffById,
  getStaffsBySchool,
  updateStaff,
} from "../../controllers/staffController";
import {
  validateStaffSignUp,
  validateUpdateStaff,
} from "../../middlewares/Validators";
import { ADMIN_ROLES } from "../../config/constants";

const router = express.Router();


router.post(
  "/",
  roleAuthorization([...ADMIN_ROLES]),
  validateStaffSignUp,
  staffSignUp
);
router.get("/school/:schoolId", roleAuthorization([...ADMIN_ROLES]), getStaffsBySchool);

router.get("/:schoolId/:staffId", roleAuthorization([...ADMIN_ROLES]), getStaffById);
router.put("/:staffId", verifyToken, validateUpdateStaff, updateStaff);
router.delete(
  "/:schoolId/:staffId",
  roleAuthorization([...ADMIN_ROLES]),
  deleteStaff
);

export default router;
