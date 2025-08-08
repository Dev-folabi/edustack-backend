import express from "express";
import {
  createSchool,
  deleteSchool,
  getUserSchools,
  getSchool,
  updateSchool,
  getAllSchools,
} from "../../controllers/schoolController";
import {
  validateCreateSchool,
  validateDeleteSchool,
  validateGetSchool,
  validateUpdateSchool,
} from "../../middlewares/Validators";
import { roleAuthorization, verifyToken } from "../../middlewares/authorization"; // Added verifyToken

const router = express.Router();

// Create School
router.post(
  "/",
  verifyToken,
  roleAuthorization(["admin"]),
  validateCreateSchool,
  createSchool
);

// Get User School
router.get("/", verifyToken, getUserSchools);

// Get All Schools
router.get(
  "/all",
  verifyToken,
  roleAuthorization(["super_admin"]),
  getAllSchools
);

// Get Single School
router.get("/:id", verifyToken, validateGetSchool, getSchool);

//  Update School
router.put(
  "/:id",
  verifyToken,
  roleAuthorization(["admin"]),
  validateUpdateSchool,
  updateSchool
);

// Delete School
router.delete(
  "/:id",
  verifyToken,
  roleAuthorization(["admin"]),
  validateDeleteSchool,
  deleteSchool
);

export default router;
