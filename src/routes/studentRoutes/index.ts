import express from "express";
import {
  getStudentsBySchool,
  getTransferStudentsBySchool,
  promoteStudent,
  transferStudent,
  getStudentDetails,
  updateStudent,
} from "../../controllers/studentController";
import {
  validatePromoteStudent,
  validateStudentSignUp,
  validateStudentUpdate,
  validateTransferStudent,
} from "../../middlewares/Validators";
import { studentSignUp } from "../../controllers/authController";
import { roleAuthorization } from "../../middlewares/authorization";
import { ADMIN_ROLES, TEACHER_ROLES } from "../../config/constants";

const router = express.Router();

router.post(
  "/register/:schoolId",
  roleAuthorization([...ADMIN_ROLES]),
  validateStudentSignUp,
  studentSignUp
);

router.put("/promote", roleAuthorization([...TEACHER_ROLES]), validatePromoteStudent, promoteStudent);
router.put("/transfer", roleAuthorization([...ADMIN_ROLES]), validateTransferStudent, transferStudent);

router.get("/:schoolId/transfer", roleAuthorization([...ADMIN_ROLES]), getTransferStudentsBySchool);
router.get("/:schoolId/all", roleAuthorization([...TEACHER_ROLES]), getStudentsBySchool);

router.get("/:studentId", roleAuthorization([...TEACHER_ROLES]), getStudentDetails);
router.put(
  "/:studentId",
  roleAuthorization([...ADMIN_ROLES]),
  validateStudentUpdate,
  updateStudent
);

export default router;
