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
  validatePromoteStudent,
  validateTransferStudent,
} from "../../middlewares/Validators";

const router = express.Router();


router.put("/promote", validatePromoteStudent, promoteStudent);
router.put("/transfer", validateTransferStudent, transferStudent);

router.get("/:studentId", getStudentDetails);
router.get("/:schoolId/transfer", getTransferStudentsBySchool);
router.get("/:schoolId/all", getStudentsBySchool);

export default router;


