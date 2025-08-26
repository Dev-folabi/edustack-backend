import express from "express";
import { verifyToken } from "../../middlewares/authorization";
import { generateStudentTermReport } from "../../controllers/reportController";

const router = express.Router();

// All report routes are protected
router.use(verifyToken);

router.get("/student-term-report", generateStudentTermReport);

export default router;
