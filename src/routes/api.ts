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


export default router;
