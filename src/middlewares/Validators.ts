import { Request, Response, NextFunction } from "express";
import { validationResult, body, param, query } from "express-validator";
import validator from "validator";

const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: errors.array()[0].msg || "Invalid data sent",
      errors: errors.array(),
    });
    return;
  }
  next();
};

// Validation for creating a school
export const validateCreateSchool = [
  body("name").notEmpty().withMessage("School name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone")
    .optional()
    .isArray()
    .withMessage("Phone must be an array of strings")
    .custom((value: string[]) => {
      if (value.length < 1 || value.length > 3) {
        throw new Error(
          "Minimum of one phone number and a maximum of three are allowed"
        );
      }
      if (!value.every((v) => typeof v === "string")) {
        throw new Error("All phone numbers must be strings");
      }
      return true;
    }),
  body("address").notEmpty().withMessage("Address is required"),
  body("isActive").isBoolean().withMessage("isActive must be a boolean"),
  body("adminId")
    .optional()
    .isString()
    .withMessage("Admin ID must be a string"),

  handleValidationErrors,
];

// Validation for updating a school
export const validateUpdateSchool = [
  param("id").isString().withMessage("School ID must be a string"),
  body("name").optional().notEmpty().withMessage("School name cannot be empty"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("phone")
    .optional()
    .isArray()
    .withMessage("Phone must be an array of strings")
    .custom((value: string[]) => {
      if (value.length < 1 || value.length > 3) {
        throw new Error(
          "Minimum of one phone number and a maximum of three are allowed"
        );
      }
      if (!value.every((v) => typeof v === "string")) {
        throw new Error("All phone numbers must be strings");
      }
      return true;
    }),
  body("address").optional().notEmpty().withMessage("Address cannot be empty"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  handleValidationErrors,
];

// Validation for getting a school by ID
export const validateGetSchool = [
  param("id").isString().withMessage("School ID must be a string"),
  handleValidationErrors,
];

// Validation for deleting a school
export const validateDeleteSchool = [
  param("id").isString().withMessage("School ID must be a string"),
  handleValidationErrors,
];

// Validation for Super Admin Signup
export const validateSuperAdminSignUp = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required"),
  body("password")
    .notEmpty()
    .withMessage("Passworg is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("username")
    .notEmpty()
    .withMessage("Username is required")
    .isString()
    .withMessage("Username must be string"),
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isString()
    .withMessage("Name must be string"),

  handleValidationErrors,
];

// Validation for Staff Signup
export const validateStaffSignUp = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("username")
    .notEmpty()
    .withMessage("Username is required")
    .isString()
    .withMessage("Username must be string"),
  body("schoolId")
    .notEmpty()
    .withMessage("School ID is required")
    .isString()
    .withMessage("School ID must be string"),
  body("role")
    .optional()
    .isString()
    .withMessage("Role must be string")
    .isIn(["admin", "teacher", "accountant", "librarian"])
    .withMessage(
      "Staff role can only be admin, teacher, accountant, or librarian"
    )
    .customSanitizer((value) => {
      return value ? value.toLowerCase() : value;
    }),
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isString()
    .withMessage("Name must be a string"),
  body("phone")
    .isArray()
    .withMessage("Phone must be an array of strings")
    .optional()
    .custom((value: string[]) => {
      if (!value.every((v) => typeof v === "string")) {
        throw new Error("All phone numbers must be strings");
      }
      return true;
    }),
  body("address")
    .notEmpty()
    .withMessage("Address is required")
    .isString()
    .withMessage("Address must be a string"),
  body("gender")
    .notEmpty()
    .withMessage("Gender is required")
    .isString()
    .withMessage("Gender must be a string")
    .customSanitizer((value) => {
      return value ? value.toLowerCase() : value;
    }),
  body("designation")
    .optional()
    .isString()
    .withMessage("Designation must be a string"),
  body("dob")
    .optional()
    .isDate()
    .withMessage("Date of birth must be a valid date"),
  body("salary").optional().isNumeric().withMessage("Salary must be a number"),
  body("joining_date")
    .optional()
    .isDate()
    .withMessage("Joining date must be a valid date"),
  body("photo_url")
    .optional()
    .isString()
    .withMessage("Photo URL must be a string"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body("qualification")
    .optional()
    .isString()
    .withMessage("Qualification must be a string"),
  body("notes").optional().isString().withMessage("Notes must be a string"),
  body("section_id")
    .optional()
    .isString()
    .withMessage("Section Id must be a string"),

  handleValidationErrors,
];

// Validation for Student Signup
export const validateStudentSignUp = [
  body("schoolId")
    .notEmpty()
    .withMessage("School ID is required")
    .isString()
    .withMessage("School ID must be a string"),

  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isString()
    .withMessage("Name must be a string")
    .trim(),

  body("gender")
    .notEmpty()
    .withMessage("Gender is required")
    .isString()
    .withMessage("Gender must be a string")
    .customSanitizer((value) => value.toLowerCase().trim()),

  body("dob")
    .notEmpty()
    .withMessage("Date of birth is required")
    .isISO8601()
    .withMessage("Date of birth must be a valid date"),

  body("phone").optional().isString().withMessage("Phone must be a string"),

  body("address")
    .notEmpty()
    .withMessage("Address is required")
    .isString()
    .withMessage("Address must be a string")
    .trim(),

  body("admission_date")
    .optional()
    .isISO8601()
    .withMessage("Admission date must be a valid date"),

  body("classId")
    .notEmpty()
    .withMessage("Class ID is required")
    .isString()
    .withMessage("Class ID must be a string"),

  body("sectionId")
    .notEmpty()
    .withMessage("Section ID is required")
    .isString()
    .withMessage("Section ID must be a string"),

  body("religion")
    .notEmpty()
    .withMessage("Religion is required")
    .isString()
    .withMessage("Religion must be a string")
    .trim(),

  body("blood_group")
    .optional()
    .isString()
    .withMessage("Blood group must be a string"),

  body("father_name")
    .optional()
    .isString()
    .withMessage("Father's name must be a string"),
  body("mother_name")
    .optional()
    .isString()
    .withMessage("Mother's name must be a string"),

  body("father_occupation")
    .optional()
    .isString()
    .withMessage("Father's occupation must be a string"),
  body("mother_occupation")
    .optional()
    .isString()
    .withMessage("Mother's occupation must be a string"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  body("city")
    .notEmpty()
    .withMessage("City is required")
    .isString()
    .withMessage("City must be a string")
    .trim(),

  body("state")
    .notEmpty()
    .withMessage("State is required")
    .isString()
    .withMessage("State must be a string")
    .trim(),

  body("country")
    .notEmpty()
    .withMessage("Country is required")
    .isString()
    .withMessage("Country must be a string")
    .trim(),

  body("route_vehicle_id")
    .optional()
    .isString()
    .withMessage("Route vehicle ID must be a string"),
  body("room_id").optional().isString().withMessage("Room ID must be a string"),
  body("added_by")
    .optional()
    .isString()
    .withMessage("Added by must be a string"),
  body("photo_url")
    .optional()
    .isString()
    .withMessage("Photo URL must be a string"),

  // Guardian Details
  body("exist_guardian")
    .notEmpty()
    .withMessage("exist_guardian is required")
    .isBoolean()
    .withMessage("exist_guardian must be a boolean"),

  body("guardian_name")
    .if((value, { req }) => req.body.exist_guardian === false)
    .notEmpty()
    .withMessage("Guardian's name is required")
    .isString()
    .withMessage("Guardian's name must be a string")
    .trim()
    .bail()
    .optional(),

  body("guardian_phone")
    .if((value, { req }) => req.body.exist_guardian === false)
    .notEmpty()
    .withMessage("Guardian phone is required")
    .isArray()
    .withMessage("Guardian phone must be an array of strings")
    .custom((value: string[]) => {
      if (!value.every((v) => typeof v === "string")) {
        throw new Error("All guardian phone numbers must be strings");
      }
      return true;
    })
    .bail()
    .optional(),

  body("guardian_email")
    .notEmpty()
    .withMessage("Guardian email is required")
    .isEmail()
    .withMessage("Guardian email must be valid"),

  body("guardian_username")
    .notEmpty()
    .withMessage("Guardian username is required")
    .isString()
    .withMessage("Guardian username must be a string"),

  body("guardian_password")
    .notEmpty()
    .withMessage("Guardian password is required")
    .isString()
    .withMessage("Guardian password must be a string")
    .isLength({ min: 6 })
    .withMessage("Guardian password must be at least 6 characters long"),

  handleValidationErrors,
];

// Validate Verify Email OTP
export const validateVerifyEmailOTP = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isString()
    .withMessage("User ID must be a string"),
  body("otp")
    .notEmpty()
    .withMessage("OTP is required")
    .isString()
    .withMessage("OTP must be a string")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),
  handleValidationErrors,
];

// Validate Resend OTP
export const validateResendOTP = [
  body("type")
    .trim()
    .notEmpty()
    .withMessage("type is required")
    .isIn(["email_verification", "password_reset"])
    .withMessage("type can only be email_verification or password_reset"),
  body("id")
    .if(body("type").equals("email_verification"))
    .trim()
    .notEmpty()
    .withMessage("Id is required for email verification"),
  body("email")
    .if(body("type").equals("password_reset"))
    .trim()
    .notEmpty()
    .withMessage("Email is required for password reset"),
  handleValidationErrors,
];

// Validate Request Password Reset
export const validateRequestPasswordReset = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email address"),
  handleValidationErrors,
];

// Validate Reset Password
export const validateResetPassword = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isString()
    .withMessage("User ID must be a string"),
  body("otp")
    .notEmpty()
    .withMessage("OTP is required")
    .isString()
    .withMessage("OTP must be a string")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),
  body("newPassword")
    .trim()
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  handleValidationErrors,
];

// Validation Sign in
export const validateSignIn = [
  body("emailOrUsername")
    .trim()
    .notEmpty()
    .withMessage("Email or Username is required")
    .custom((value) => {
      const isEmail = validator.isEmail(value);
      const isUsername = typeof value === "string" && value.length >= 3;
      if (!isEmail && !isUsername) {
        throw new Error(
          "Must be a valid email or a username with at least 3 characters"
        );
      }
      return true;
    }),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  // .matches(/(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/)
  // .withMessage(
  //   "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character"
  // ),
  handleValidationErrors, // Middleware to handle validation errors
];

export const validateCreateSession = [
  body("label")
    .trim()
    .notEmpty()
    .withMessage("Label is required")
    .isString()
    .withMessage("Label must be a string"),
  body("start_date")
    .trim()
    .notEmpty()
    .withMessage("Start date is required")
    .isDate()
    .withMessage("End date must be a valid date"),
  body("end_date")
    .trim()
    .notEmpty()
    .withMessage("End date is required")
    .isDate()
    .withMessage("End date must be a valid date"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("Is active must be a boolean"),
  body("terms")
    .isArray({ min: 1 })
    .withMessage("At least one term must be provided")
    .custom((terms) => {
      terms.forEach((term: any) => {
        if (!term.label) throw new Error("Each term must have a label");
        if (!term.start_date || !term.end_date)
          throw new Error("Each term must have start and end dates");
        if (new Date(term.start_date) >= new Date(term.end_date))
          throw new Error(
            `Term "${term.label}" has invalid dates: start_date must be earlier than end_date`
          );
      });
      return true;
    }),
  handleValidationErrors,
];

export const validateUpdateSession = [
  body("label").optional().isString().withMessage("Label must be a string"),
  body("start_date")
    .optional()
    .isDate()
    .withMessage("Start date must be a valid date"),
  body("end_date")
    .optional()
    .isDate()
    .withMessage("End date must be a valid date"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("Is active must be a boolean"),
  body("terms")
    .optional()
    .isArray()
    .withMessage("Terms must be an array")
    .custom((terms) => {
      terms.forEach((term: any) => {
        if (!term.label) throw new Error("Each term must have a label");
        if (!term.start_date || !term.end_date)
          throw new Error("Each term must have start and end dates");
        if (new Date(term.start_date) >= new Date(term.end_date))
          throw new Error(
            `Term "${term.label}" has invalid dates: start_date must be earlier than end_date`
          );
      });
      return true;
    }),
  handleValidationErrors,
];

export const validateDeleteSession = [
  param("id")
    .trim()
    .notEmpty()
    .withMessage("Session ID is required")
    .isString()
    .withMessage("Session ID must be a string"),
  handleValidationErrors,
];

// Validator for creating a class
export const validateCreateClass = [
  body("label")
    .notEmpty()
    .withMessage("Label is required")
    .isString()
    .withMessage("Label must be a string"),
  body("section")
    .optional()
    .isString()
    .withMessage("Section must be an string"),
  // .custom((value: unknown[]) => {
  //   if (!value.every((item) => typeof item === "string")) {
  //     throw new Error("Each section must be a string");
  //   }
  //   return true;
  // }),
  body("school_id")
    .notEmpty()
    .withMessage("School IDs are required")
    .isArray()
    .withMessage("School IDs must be an array")
    .custom((value: unknown[]) => {
      if (!value.every((item) => typeof item === "string")) {
        throw new Error("Each school ID must be a string");
      }
      return true;
    }),
  body("teacherId")
    .optional()
    .isString()
    .withMessage("teacher ID must be an string"),

  handleValidationErrors,
];

// Validator for updating a class
export const validateUpdateClass = [
  param("id")
    .notEmpty()
    .withMessage("Class ID is required")
    .isString()
    .withMessage("Class ID must be a string"),
  body("label").optional().isString().withMessage("Label must be a string"),
  body("section")
    .optional()
    .isString()
    .withMessage("Section must be an string"),
  // .custom((value: unknown[]) => {
  //   if (!value.every((item) => typeof item === "string")) {
  //     throw new Error("Each section must be a string");
  //   }
  //   return true;
  // }),
  body("school_id")
    .optional()
    .isArray()
    .withMessage("School IDs must be an array")
    .custom((value: unknown[]) => {
      if (!value.every((item) => typeof item === "string")) {
        throw new Error("Each school ID must be a string");
      }
      return true;
    }),
  handleValidationErrors,
];

export const validateTransferStudent = [
  body("studentId")
    .notEmpty()
    .withMessage("Student IDs are required")
    .isArray()
    .withMessage("Student IDs must be an array")
    .custom((value: unknown[]) => {
      if (!value.every((item) => typeof item === "string")) {
        throw new Error("Each student ID must be a string");
      }
      return true;
    }),
  body("toSchoolId")
    .notEmpty()
    .withMessage("To school ID is required")
    .isString()
    .withMessage("To school ID must be a string"),
  body("toClassId")
    .notEmpty()
    .withMessage("To Class ID is required")
    .isString()
    .withMessage("To Class ID must be a string"),
  body("toSectionId")
    .notEmpty()
    .withMessage("To Section ID is required")
    .isString()
    .withMessage("To Section ID must be a string"),
  body("transferReason")
    .optional()
    .isString()
    .withMessage("Transfer reason must be a string"),
  handleValidationErrors,
];

export const validateEnrollStudent = [
  body("studentId")
    .notEmpty()
    .withMessage("Student ID is required")
    .isString()
    .withMessage("Student ID must be a string"),
  body("classId")
    .notEmpty()
    .withMessage("Class ID is required")
    .isString()
    .withMessage("Class ID must be a string"),
  body("sectionId")
    .notEmpty()
    .withMessage("Section ID is required")
    .isString()
    .withMessage("Section ID must be a string"),
  handleValidationErrors,
];

export const validatePromoteStudent = [
  body("studentId")
    .notEmpty()
    .withMessage("Student IDs are required")
    .isArray()
    .withMessage("Student IDs must be an array")
    .custom((value: unknown[]) => {
      if (!value.every((item) => typeof item === "string")) {
        throw new Error("Each student ID must be a string");
      }
      return true;
    }),
  body("fromClassId")
    .notEmpty()
    .withMessage("From class ID is required")
    .isString()
    .withMessage("From class ID must be a string"),
  body("toClassId")
    .notEmpty()
    .withMessage("To class ID is required")
    .isString()
    .withMessage("To class ID must be a string"),
  body("sectionId")
    .notEmpty()
    .withMessage("Section ID is required")
    .isString()
    .withMessage("Section ID must be a string"),
  handleValidationErrors,
];

// Validation for sending bulk messages
export const validateSendBulkMessage = [
  body("recipients")
    .notEmpty()
    .withMessage("Recipients are required")
    .isObject()
    .withMessage("Recipients must be an object"),
  body("recipients.staffIds")
    .optional()
    .isArray()
    .withMessage("Staff IDs must be an array of strings")
    .custom((value: unknown[]) => {
      if (value && !value.every((item) => typeof item === "string")) {
        throw new Error("Each staffId ID must be a string");
      }
      return true;
    }),
  body("recipients.studentIds")
    .optional()
    .isArray()
    .withMessage("Student IDs must be an array of strings")
    .custom((value: unknown[]) => {
      if (value && !value.every((item) => typeof item === "string")) {
        throw new Error("Each student ID must be a string");
      }
      return true;
    }),
  body("recipients.classId")
    .optional()
    .isString()
    .withMessage("Class ID must be a string"),
  body("recipients.schoolId")
    .optional()
    .isString()
    .withMessage("School ID must be a string"),
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isString()
    .withMessage("Title must be a string"),
  body("message")
    .notEmpty()
    .withMessage("Message is required")
    .isString()
    .withMessage("Message must be a string"),
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isString()
    .withMessage("Category must be a string")
    .customSanitizer((value) => value.toUpperCase()),
  body("channels")
    .isArray()
    .withMessage("Channels must be an array")
    .isIn(["EMAIL", "IN_APP", "BOTH"])
    .withMessage("Channels must include 'EMAIL', 'IN_APP', or 'BOTH'"),
  body("scheduledAt")
    .optional()
    .isISO8601()
    .withMessage("Scheduled time must be a valid ISO 8601 date"),
  handleValidationErrors,
];

// Validation for fetching notifications for a user
export const validateGetNotificationsForUser = [
  query("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .customSanitizer((value) => value.toUpperCase()),
  query("status").optional().isString().withMessage("Status must be a string"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),
  handleValidationErrors,
];
