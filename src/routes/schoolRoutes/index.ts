import express from "express";
import {
  createSchool,
  deleteSchool,
  getUserSchools,
  getSchool,
  updateSchool,
  getAllSchools,
  getSchoolDashboard,
} from "../../controllers/schoolController";
import {
  validateCreateSchool,
  validateDeleteSchool,
  validateGetSchool,
  validateUpdateSchool,
} from "../../middlewares/Validators";
import {
  roleAuthorization,
  verifyToken,
} from "../../middlewares/authorization";
import { SUPER_ADMIN_ROLES, ADMIN_ROLES } from "../../config/constants";

const router = express.Router();

// Create School
router.post(
  "/",
  verifyToken,
  roleAuthorization([...SUPER_ADMIN_ROLES]),

  validateCreateSchool,
  createSchool
);

// Get User School
router.get("/", verifyToken, getUserSchools);

// Get All Schools
router.get("/all", getAllSchools);

// Get Single School
router.get("/:id", verifyToken, validateGetSchool, getSchool);

//  Update School
router.put(
  "/:id",
  verifyToken,
  roleAuthorization([...SUPER_ADMIN_ROLES]),

  validateUpdateSchool,
  updateSchool
);

// Delete School
router.delete(
  "/:id",
  verifyToken,
  roleAuthorization([...SUPER_ADMIN_ROLES]),
  validateDeleteSchool,
  deleteSchool
);

// Get School Dashboard
router.get(
  "/dashboard/:schoolId",
  verifyToken,
  roleAuthorization([...ADMIN_ROLES]),
  getSchoolDashboard
);

export default router;
