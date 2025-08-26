import express from "express";
import authRoute from "./authRoutes";
import schoolRoute from "./schoolRoutes";
import sessionRoutes from "./sessionRoutes";
import classRoutes from "./classRoutes";
import studentRoutes from "./studentRoutes";
import staffRoutes from "./staffRoutes";
import notificationRoutes from "./notificationRoutes"
import subjectRoutes from "./subjectRoutes"
import { verifyToken } from "../middlewares/authorization";
import attendanceRoutes from "./attendanceRoutes";
import timetableRoutes from "./timetableRoutes";
import examSettingsRoutes from "./examRoutes";
import examManagementRoutes from "./examRoutes/management";
import questionBankRoutes from "./examRoutes/questionBank";
import cbtRoutes from "./cbtRoutes";
import resultsRoutes from "./resultsRoutes";
import psychomotorRoutes from "./psychomotorRoutes";
import reportRoutes from "./reportRoutes";


const router = express.Router();

router.use("/auth", authRoute);
router.use("/school", schoolRoute);
router.use("/session", sessionRoutes);
router.use("/class", classRoutes);
router.use("/students", studentRoutes);
router.use("/staff", staffRoutes);
router.use("/notify", notificationRoutes)
router.use("/subjects", verifyToken, subjectRoutes)
router.use("/attendance", verifyToken, attendanceRoutes)
router.use("/timetables", verifyToken, timetableRoutes)
router.use("/exam/settings", examSettingsRoutes)
router.use("/exams", examManagementRoutes)
router.use("/question-banks", questionBankRoutes)
router.use("/cbt", cbtRoutes)
router.use("/results", resultsRoutes)
router.use("/psychomotor", psychomotorRoutes)
router.use("/reports", reportRoutes)



export default router;
