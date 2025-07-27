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
  verifyToken, // Ensuring token is valid before checking roles
  roleAuthorization(["admin"]),
  validateCreateSchool,
  createSchool
);

// Get User School - Assuming this should also be protected by verifyToken at least
router.get("/", verifyToken, getUserSchools);

// Get All Schools
router.get(
  "/all",
  verifyToken, // First, ensure token is valid
  roleAuthorization(["super_admin"]), // Then, check if the user has the 'super_admin' role
  getAllSchools
);

// Get Single School - Assuming this should also be protected by verifyToken
router.get("/:id", verifyToken, validateGetSchool, getSchool);

//  Update School
router.put(
  "/:id",
  verifyToken, // Ensuring token is valid before checking roles
  roleAuthorization(["admin"]),
  validateUpdateSchool,
  updateSchool
);

// Delete School
router.delete(
  "/:id",
  verifyToken, // Ensuring token is valid before checking roles
  roleAuthorization(["admin"]),
  validateDeleteSchool,
  deleteSchool
);

export default router;
