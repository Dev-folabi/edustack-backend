import express from "express";
import authRoute from "./authRoutes";
import schoolRoute from "./schoolRoutes";
import sessionRoutes from "./sessionRoutes";
import classRoutes from "./classRoutes";
import studentRoutes from "./studentRoutes";
import staffRoutes from "./staffRoutes";
import notificationRoutes from "./notificationRoutes";
import subjectRoutes from "./subjectRoutes";
import { verifyToken } from "../middlewares/authorization";
import attendanceRoutes from "./attendanceRoutes";
import timetableRoutes from "./timetableRoutes";
import examSettingsRoutes from "./examAndCbtRoutes/examRoutes";
import examManagementRoutes from "./examAndCbtRoutes/examRoutes/management";
import questionBankRoutes from "./examAndCbtRoutes/examRoutes/questionBank";
import cbtRoutes from "./examAndCbtRoutes/cbtRoutes";
import resultsRoutes from "./examAndCbtRoutes/resultsRoutes";
import psychomotorRoutes from "./examAndCbtRoutes/psychomotorRoutes";
import reportRoutes from "./examAndCbtRoutes/reportRoutes";

const router = express.Router();

const examRoutes = express.Router();
examRoutes.use("/settings", examSettingsRoutes);
examRoutes.use("/management", examManagementRoutes);
examRoutes.use("/question-banks", questionBankRoutes);
examRoutes.use("/cbt", cbtRoutes);
examRoutes.use("/results", resultsRoutes);
examRoutes.use("/psychomotor", psychomotorRoutes);
examRoutes.use("/reports", reportRoutes);

router.use("/auth", authRoute);
router.use("/school", schoolRoute);
router.use("/session", sessionRoutes);
router.use("/class", classRoutes);
router.use("/students", studentRoutes);
router.use("/staff", staffRoutes);
router.use("/notify", notificationRoutes);
router.use("/subjects", verifyToken, subjectRoutes);
router.use("/attendance", verifyToken, attendanceRoutes);
router.use("/timetables", verifyToken, timetableRoutes);
router.use("/exam", examRoutes);

export default router;
