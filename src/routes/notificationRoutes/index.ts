import express from "express";
import {
  getNotificationsForUser,
  sendBulkMessages,
} from "../../controllers/notificationController";
import {
  roleAuthorization,
  verifyToken,
} from "../../middlewares/authorization";
import {
  validateGetNotificationsForUser,
  validateSendBulkMessage,
} from "../../middlewares/Validators";

const router = express.Router();

// Send or schedule bulk notifications to students/staff
router.post(
  "/",
  validateSendBulkMessage,
  roleAuthorization(["admin"]),
  sendBulkMessages
);

// Fetch real-time notifications for a user with optional filters
router.get(
  "/",
  validateGetNotificationsForUser,
  verifyToken,
  getNotificationsForUser
);

export default router;
