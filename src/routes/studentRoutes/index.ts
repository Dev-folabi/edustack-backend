import express from "express";
import {
  // enrollStudent,
  getStudentsBySchool,
  getTransferStudentsBySchool,
  promoteStudent,
  transferStudent,
  getStudentDetails,
} from "../../controllers/studentController";
import {
  validateEnrollStudent,
  validatePromoteStudent,
  validateTransferStudent,
} from "../../middlewares/Validators";

const router = express.Router();

// router.post("/enroll", validateEnrollStudent, enrollStudent);
router.put("/promote", validatePromoteStudent, promoteStudent);
router.put("/transfer", validateTransferStudent, transferStudent);

router.get("/:schoolId/transfer", getTransferStudentsBySchool);
router.get("/:schoolId/all", getStudentsBySchool);
router.get("/:studentId", getStudentDetails);

export default router;


