import { Router } from "express";
import {
  getStaffAttendance,
  getStudentAttendance,
  takeSectionAttendance,
  takeStaffAttendance,
  takeSubjectAttendance,
} from "../../controllers/attendanceController";
import { roleAuthorization } from "../../middlewares/authorization";
import { ADMIN_ROLES, TEACHER_ROLES } from "../../config/constants";
import {
  validateGetStaffAttendance,
  validateGetStudentAttendance,
  validateSectionAttendance,
  validateStaffAttendance,
  validateSubjectAttendance,
} from "../../middlewares/Validators";

const router = Router();

// Class teacher
router.post(
  "/section",
  roleAuthorization([...TEACHER_ROLES]),
  validateSectionAttendance,
  takeSectionAttendance
);

// Subject teacher
router.post(
  "/subject",
  roleAuthorization([...TEACHER_ROLES]),
  validateSubjectAttendance,
  takeSubjectAttendance
);

// Student attendance viewing
router.get("/student", validateGetStudentAttendance, getStudentAttendance);

// Staff attendance
router.post(
  "/staff",
  roleAuthorization([...ADMIN_ROLES]),
  validateStaffAttendance,
  takeStaffAttendance
);
router.get("/staff", validateGetStaffAttendance, getStaffAttendance);

export default router;
