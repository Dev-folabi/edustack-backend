import express from "express";
import {
  staffSignUp,
  studentSignUp,
  superAdminSignUp,
  userSignIn,
  verifyEmailOTP,
  resendOTP,
  requestPasswordReset,
  resetPassword,
  logoutUser,
} from "../../controllers/authController";
import { signUpvalidate } from "../../middlewares/customValidations";
import {
  validateSignIn,
  validateStaffSignUp,
  validateStudentSignUp,
  validateSuperAdminSignUp,
  validateResetPassword,
  validateRequestPasswordReset,
  validateResendOTP,
  validateVerifyEmailOTP,
} from "../../middlewares/Validators";
import { verifyToken } from "../../middlewares/authorization"; // Added verifyToken

const router = express.Router();

// Super Admin Signup
router.post(
  "/admin-signup",
  validateSuperAdminSignUp,
  signUpvalidate,
  superAdminSignUp
);

// Verify Email OTP
router.post("/verify-email-otp", validateVerifyEmailOTP, verifyEmailOTP);

// Resend OTP
router.post("/resend-otp", validateResendOTP, resendOTP);

// Request Password Reset
router.post(
  "/request-reset",
  validateRequestPasswordReset,
  requestPasswordReset
);

// Reset Password
router.post("/reset-password", validateResetPassword, resetPassword);

// Staff Signup
router.post("/staff-signup", validateStaffSignUp, signUpvalidate, staffSignUp);

// Student Signup
router.post(
  "/student-signup",
  validateStudentSignUp,
  signUpvalidate,
  studentSignUp
);

// User Sign-in
router.post("/login", validateSignIn, userSignIn);

// User Logout
router.post("/logout", verifyToken, logoutUser);

export default router;
