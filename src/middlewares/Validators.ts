import { Request, Response, NextFunction } from "express";
import { validationResult, body, param, query } from "express-validator";
import validator from "validator";
import { Gender, UserRole, NotificationCategory, NotificationType } from "@prisma/client";

/**
 * Middleware to handle the results of express-validator validations.
 * If validation errors exist, it sends a 400 response with the errors.
 * Otherwise, it calls the next middleware in the stack.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: errors.array()[0].msg || "Invalid data sent", // Send first error message as main message
      errors: errors.array(),
    });
    return;
  }
  next();
};

// Validation rules for creating a new school.
export const validateCreateSchool = [
  body("name").notEmpty().withMessage("School name is required").isString().isLength({ max: 100 }).withMessage("School name must be a string with max length 100"),
  body("email").isEmail().withMessage("Valid email is required").isLength({ max: 254 }).withMessage("Email max length is 254"),
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
      if (!value.every((v) => typeof v === "string" && v.length > 0 && v.length <= 20)) {
        throw new Error("All phone numbers must be valid strings with max length 20.");
      }
      return true;
    }),
  body("address").notEmpty().withMessage("Address is required").isString().isLength({ max: 255 }).withMessage("Address must be a string with max length 255"),
  body("isActive").isBoolean().withMessage("isActive must be a boolean"),
  body("adminId") // Optional ID of an admin to be linked to this school upon creation.
    .optional()
    .isString()
    .withMessage("Admin ID must be a string")
    .isLength({ max: 50 }).withMessage("Admin ID max length is 50"),

  handleValidationErrors,
];

// Validation rules for updating an existing school.
export const validateUpdateSchool = [
  param("id").isString().withMessage("School ID must be a string").isLength({ max: 50 }).withMessage("School ID max length is 50"),
  body("name").optional().notEmpty().withMessage("School name cannot be empty").isString().isLength({ max: 100 }).withMessage("School name must be a string with max length 100"),
  body("email").optional().isEmail().withMessage("Valid email is required").isLength({ max: 254 }).withMessage("Email max length is 254"),
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
      if (!value.every((v) => typeof v === "string" && v.length > 0 && v.length <= 20)) {
        throw new Error("All phone numbers must be valid strings with max length 20.");
      }
      return true;
    }),
  body("address").optional().notEmpty().withMessage("Address cannot be empty").isString().isLength({ max: 255 }).withMessage("Address must be a string with max length 255"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  handleValidationErrors,
];

// Validation for getting a school by its ID (checks param format).
export const validateGetSchool = [
  param("id").isString().withMessage("School ID must be a string").isLength({ max: 50 }).withMessage("School ID max length is 50"),
  handleValidationErrors,
];

// Validation for deleting a school by its ID (checks param format).
export const validateDeleteSchool = [
  param("id").isString().withMessage("School ID must be a string").isLength({ max: 50 }).withMessage("School ID max length is 50"),
  handleValidationErrors,
];

// Validation rules for Super Admin Signup.
export const validateSuperAdminSignUp = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required")
    .isLength({ max: 254 }).withMessage("Email max length is 254"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6, max: 128 })
    .withMessage("Password must be between 6 and 128 characters long"),
  body("username")
    .notEmpty()
    .withMessage("Username is required")
    .isString()
    .withMessage("Username must be string")
    .isLength({ max: 50 }).withMessage("Username max length is 50"),
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isString()
    .withMessage("Name must be string")
    .isLength({ max: 100 }).withMessage("Name max length is 100"),

  handleValidationErrors,
];

// Validation rules for Staff Signup.
export const validateStaffSignUp = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required")
    .isLength({ max: 254 }).withMessage("Email max length is 254"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6, max: 128 })
    .withMessage("Password must be between 6 and 128 characters long"),
  body("username")
    .notEmpty()
    .withMessage("Username is required")
    .isString()
    .withMessage("Username must be string")
    .isLength({ max: 50 }).withMessage("Username max length is 50"),
  body("schoolId")
    .notEmpty()
    .withMessage("School ID is required")
    .isString()
    .withMessage("School ID must be string")
    .isLength({ max: 50 }).withMessage("School ID max length is 50"),
  body("role") // Role for the staff member within the specified school.
    .optional()
    .isString()
    .withMessage("Role must be string")
    .isLength({ max: 50 }).withMessage("Role max length is 50")
    .isIn(Object.values(UserRole)) // Validates against Prisma's UserRole enum.
    .withMessage(`Role must be one of: ${Object.values(UserRole).join(", ")}`),
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isString()
    .withMessage("Name must be a string")
    .isLength({ max: 100 }).withMessage("Name max length is 100"),
  body("phone") // Array of phone numbers for staff.
    .isArray()
    .withMessage("Phone must be an array of strings")
    .optional()
    .custom((value: string[]) => {
      if (!value.every((v) => typeof v === "string" && v.length > 0 && v.length <= 20)) {
        throw new Error("All phone numbers must be valid strings with max length 20.");
      }
      return true;
    }),
  body("address")
    .notEmpty()
    .withMessage("Address is required")
    .isString()
    .withMessage("Address must be a string")
    .isLength({ max: 255 }).withMessage("Address max length is 255"),
  body("gender")
    .notEmpty()
    .withMessage("Gender is required")
    .isString()
    .isIn(Object.values(Gender)) // Validates against Prisma's Gender enum.
    .withMessage(`Gender must be one of: ${Object.values(Gender).join(", ")}`),
  body("designation")
    .optional()
    .isString()
    .withMessage("Designation must be a string")
    .isLength({ max: 100 }).withMessage("Designation max length is 100"),
  body("dob")
    .optional()
    .isDate() // General date validation, can be more specific with .isISO8601() if needed.
    .withMessage("Date of birth must be a valid date"),
  body("salary").optional().isNumeric().withMessage("Salary must be a number"),
  body("joining_date")
    .optional()
    .isDate()
    .withMessage("Joining date must be a valid date"),
  body("photo_url")
    .optional()
    .isString()
    .withMessage("Photo URL must be a string")
    .isURL().withMessage("Photo URL must be a valid URL") // Added URL validation
    .isLength({ max: 2048 }).withMessage("Photo URL max length is 2048"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body("qualification")
    .optional()
    .isString()
    .withMessage("Qualification must be a string")
    .isLength({ max: 255 }).withMessage("Qualification max length is 255"),
  body("notes").optional().isString().withMessage("Notes must be a string").isLength({ max: 2000 }).withMessage("Notes max length is 2000"),
  body("section_id") // ID of the section the staff member might be a class teacher for.
    .optional()
    .isString()
    .withMessage("Section Id must be a string")
    .isLength({ max: 50 }).withMessage("Section ID max length is 50"),

  handleValidationErrors,
];

// Validation rules for Student Signup. Includes student details and guardian information.
export const validateStudentSignUp = [
  // Student's own credentials and basic info
  body("email").notEmpty().withMessage("Student email is required").isEmail().withMessage("Student email must be valid").isLength({max: 254}),
  body("username").notEmpty().withMessage("Student username is required").isString().isLength({min:3, max:50}).withMessage("Student username must be 3-50 characters"),
  body("password").notEmpty().withMessage("Student password is required").isLength({min:6, max:128}).withMessage("Student password must be 6-128 characters"),

  body("schoolId")
    .notEmpty()
    .withMessage("School ID is required")
    .isString()
    .withMessage("School ID must be a string")
    .isLength({ max: 50 }).withMessage("School ID max length is 50"),
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isString()
    .withMessage("Name must be a string")
    .isLength({ max: 100 }).withMessage("Name max length is 100")
    .trim(),
  body("gender")
    .notEmpty()
    .withMessage("Gender is required")
    .isString()
    .trim()
    .isIn(Object.values(Gender)) // Validates against Prisma's Gender enum.
    .withMessage(`Gender must be one of: ${Object.values(Gender).join(", ")}`),
  body("dob")
    .notEmpty()
    .withMessage("Date of birth is required")
    .isISO8601()
    .withMessage("Date of birth must be a valid date"),
  body("phone").optional().isString().withMessage("Phone must be a string").isLength({ max: 20 }).withMessage("Phone max length is 20"),
  body("address")
    .notEmpty()
    .withMessage("Address is required")
    .isString()
    .withMessage("Address must be a string")
    .isLength({ max: 255 }).withMessage("Address max length is 255")
    .trim(),
  body("admission_date")
    .optional()
    .isISO8601()
    .withMessage("Admission date must be a valid date"),
  body("classId")
    .notEmpty()
    .withMessage("Class ID is required")
    .isString()
    .withMessage("Class ID must be a string")
    .isLength({ max: 50 }).withMessage("Class ID max length is 50"),
  body("sectionId")
    .notEmpty()
    .withMessage("Section ID is required")
    .isString()
    .withMessage("Section ID must be a string")
    .isLength({ max: 50 }).withMessage("Section ID max length is 50"),
  body("religion")
    .notEmpty()
    .withMessage("Religion is required")
    .isString()
    .withMessage("Religion must be a string")
    .isLength({ max: 50 }).withMessage("Religion max length is 50")
    .trim(),
  body("blood_group")
    .optional()
    .isString()
    .withMessage("Blood group must be a string")
    .isLength({ max: 10 }).withMessage("Blood group max length is 10"),
  body("father_name")
    .optional()
    .isString()
    .withMessage("Father's name must be a string")
    .isLength({ max: 100 }).withMessage("Father's name max length is 100"),
  body("mother_name")
    .optional()
    .isString()
    .withMessage("Mother's name must be a string")
    .isLength({ max: 100 }).withMessage("Mother's name max length is 100"),
  body("father_occupation")
    .optional()
    .isString()
    .withMessage("Father's occupation must be a string")
    .isLength({ max: 100 }).withMessage("Father's occupation max length is 100"),
  body("mother_occupation")
    .optional()
    .isString()
    .withMessage("Mother's occupation must be a string")
    .isLength({ max: 100 }).withMessage("Mother's occupation max length is 100"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body("city")
    .notEmpty()
    .withMessage("City is required")
    .isString()
    .withMessage("City must be a string")
    .isLength({ max: 100 }).withMessage("City max length is 100")
    .trim(),
  body("state")
    .notEmpty()
    .withMessage("State is required")
    .isString()
    .withMessage("State must be a string")
    .isLength({ max: 100 }).withMessage("State max length is 100")
    .trim(),
  body("country")
    .notEmpty()
    .withMessage("Country is required")
    .isString()
    .withMessage("Country must be a string")
    .isLength({ max: 100 }).withMessage("Country max length is 100")
    .trim(),
  body("route_vehicle_id")
    .optional()
    .isString()
    .withMessage("Route vehicle ID must be a string")
    .isLength({ max: 50 }).withMessage("Route vehicle ID max length is 50"),
  body("room_id").optional().isString().withMessage("Room ID must be a string").isLength({ max: 50 }).withMessage("Room ID max length is 50"),
  body("added_by") // ID of the user who added this student, if applicable.
    .optional()
    .isString()
    .withMessage("Added by must be a string")
    .isLength({ max: 50 }).withMessage("Added by max length is 50"),
  body("photo_url")
    .optional()
    .isString()
    .isURL().withMessage("Photo URL must be a valid URL.")
    .withMessage("Photo URL must be a string")
    .isLength({ max: 2048 }).withMessage("Photo URL max length is 2048"),

  // Guardian Details Section
  body("exist_guardian") // Boolean indicating if an existing guardian account is being used.
    .notEmpty()
    .withMessage("exist_guardian is required")
    .isBoolean()
    .withMessage("exist_guardian must be a boolean"),
  // Conditional validation: these fields are required only if exist_guardian is false (i.e., creating a new guardian).
  body("guardian_name")
    .if((value, { req }) => req.body.exist_guardian === false)
    .notEmpty()
    .withMessage("Guardian's name is required when creating a new guardian")
    .isString()
    .withMessage("Guardian's name must be a string")
    .isLength({ max: 100 }).withMessage("Guardian's name max length is 100")
    .trim()
    .bail() // Stop validation if this fails and it's a new guardian scenario.
    .optional(), // Make it optional overall, as it depends on `exist_guardian`.
  body("guardian_phone")
    .if((value, { req }) => req.body.exist_guardian === false)
    .notEmpty()
    .withMessage("Guardian phone is required when creating a new guardian")
    .isArray()
    .withMessage("Guardian phone must be an array of strings")
    .custom((value: string[]) => {
      if (!value.every((v) => typeof v === "string" && v.length > 0 && v.length <= 20)) {
        throw new Error("All guardian phone numbers must be valid strings with max length 20.");
      }
      return true;
    })
    .bail()
    .optional(),
  // These guardian fields are always required, regardless of `exist_guardian` value,
  // as they are used to either find an existing guardian or create a new one.
  body("guardian_email")
    .notEmpty()
    .withMessage("Guardian email is required")
    .isEmail()
    .withMessage("Guardian email must be valid")
    .isLength({ max: 254 }).withMessage("Guardian email max length is 254"),
  body("guardian_username")
    .notEmpty()
    .withMessage("Guardian username is required")
    .isString()
    .withMessage("Guardian username must be a string")
    .isLength({ max: 50 }).withMessage("Guardian username max length is 50"),
  body("guardian_password")
    .notEmpty()
    .withMessage("Guardian password is required")
    .isString()
    .withMessage("Guardian password must be a string")
    .isLength({ min: 6, max: 128 })
    .withMessage("Guardian password must be between 6 and 128 characters long"),

  handleValidationErrors,
];

// Validation for verifying an email OTP.
export const validateVerifyEmailOTP = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isString()
    .withMessage("User ID must be a string")
    .isLength({ max: 50 }).withMessage("User ID max length is 50"),
  body("otp")
    .notEmpty()
    .withMessage("OTP is required")
    .isString()
    .withMessage("OTP must be a string")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),
  handleValidationErrors,
];

// Validation for resending an OTP.
export const validateResendOTP = [
  body("type") // Type of OTP to resend (e.g., for email verification or password reset).
    .trim()
    .notEmpty()
    .withMessage("type is required")
    .isIn(["email_verification", "password_reset"])
    .withMessage("type can only be email_verification or password_reset"),
  body("id") // User ID, required if type is 'email_verification'.
    .if(body("type").equals("email_verification"))
    .trim()
    .notEmpty()
    .withMessage("Id is required for email verification")
    .isLength({ max: 50 }).withMessage("ID max length is 50"),
  body("email") // User email, required if type is 'password_reset'.
    .if(body("type").equals("password_reset"))
    .trim()
    .notEmpty()
    .withMessage("Email is required for password reset")
    .isEmail().withMessage("Must be a valid email")
    .isLength({ max: 254 }).withMessage("Email max length is 254"),
  handleValidationErrors,
];

// Validation for requesting a password reset.
export const validateRequestPasswordReset = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email address")
    .isLength({ max: 254 }).withMessage("Email max length is 254"),
  handleValidationErrors,
];

// Validation for resetting a password with an OTP.
export const validateResetPassword = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isString()
    .withMessage("User ID must be a string")
    .isLength({ max: 50 }).withMessage("User ID max length is 50"),
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
    .isLength({ min: 6, max: 128 })
    .withMessage("Password must be between 6 and 128 characters long"),
  handleValidationErrors,
];

// Validation for user sign-in.
export const validateSignIn = [
  body("emailOrUsername") // Accepts either an email or a username.
    .trim()
    .notEmpty()
    .withMessage("Email or Username is required")
    .isLength({ max: 254 }) // Max length accommodates email; username should be shorter.
    .custom((value) => { // Custom logic to check if it's a valid email or a plausible username.
      const isEmail = validator.isEmail(value);
      const isUsername = typeof value === "string" && value.length >= 3; // Basic username check
      if (!isEmail && !isUsername) {
        throw new Error(
          "Must be a valid email or a username (at least 3 characters)"
        );
      }
      return true;
    }),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6, max: 128 })
    .withMessage("Password must be between 6 and 128 characters long"),
  handleValidationErrors,
];

// Validation rules for creating a new academic session and its terms.
export const validateCreateSession = [
  body("label")
    .trim()
    .notEmpty()
    .withMessage("Label is required")
    .isString()
    .withMessage("Label must be a string")
    .isLength({ max: 100 }).withMessage("Label max length is 100"),
  body("start_date")
    .trim()
    .notEmpty()
    .withMessage("Start date is required")
    .isISO8601() // Expecting ISO8601 date format
    .withMessage("Start date must be a valid ISO8601 date"),
  body("end_date")
    .trim()
    .notEmpty()
    .withMessage("End date is required")
    .isISO8601()
    .withMessage("End date must be a valid ISO8601 date"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("Is active must be a boolean"),
  body("terms") // Expects an array of term objects.
    .isArray({ min: 1 }) // At least one term is required.
    .withMessage("At least one term must be provided")
    .custom((terms: Array<{label:string, start_date:string, end_date:string}>) => { // Custom validation for each term in the array.
      terms.forEach((term) => {
        if (!term.label || typeof term.label !== 'string' || term.label.length === 0 || term.label.length > 100)
            throw new Error("Each term must have a label as a non-empty string with max length 100.");
        if (!term.start_date || !validator.isISO8601(term.start_date))
            throw new Error(`Term "${term.label}" start_date must be a valid ISO8601 date.`);
        if (!term.end_date || !validator.isISO8601(term.end_date))
            throw new Error(`Term "${term.label}" end_date must be a valid ISO8601 date.`);
        if (new Date(term.start_date) >= new Date(term.end_date))
          throw new Error(
            `Term "${term.label}" has invalid dates: start_date must be earlier than end_date.`
          );
      });
      return true;
    }),
  handleValidationErrors,
];

// Validation rules for updating an existing academic session and its terms.
export const validateUpdateSession = [
  param("id").isString().isLength({max: 50}).withMessage("Session ID (param) max length 50"), // Added length check for param
  body("label").optional().isString().withMessage("Label must be a string").isLength({ max: 100 }).withMessage("Label max length is 100"),
  body("start_date")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO8601 date"),
  body("end_date")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO8601 date"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("Is active must be a boolean"),
  body("terms") // Terms array is optional for update, but if provided, elements must be valid.
    .optional()
    .isArray()
    .withMessage("Terms must be an array")
    .custom((terms: Array<{id?:string, label:string, start_date:string, end_date:string, isActive?:boolean}>) => {
      terms.forEach((term) => {
        // For updates, term.id might be present to identify existing terms.
        if (term.id && (typeof term.id !== 'string' || term.id.length > 50))
            throw new Error(`Term ID "${term.id}" must be a string with max length 50 if provided.`);
        if (!term.label || typeof term.label !== 'string' || term.label.length === 0 || term.label.length > 100)
            throw new Error("Each term must have a label as a non-empty string with max length 100.");
        if (!term.start_date || !validator.isISO8601(term.start_date))
            throw new Error(`Term "${term.label}" start_date must be a valid ISO8601 date.`);
        if (!term.end_date || !validator.isISO8601(term.end_date))
            throw new Error(`Term "${term.label}" end_date must be a valid ISO8601 date.`);
        if (new Date(term.start_date) >= new Date(term.end_date))
          throw new Error(
            `Term "${term.label}" has invalid dates: start_date must be earlier than end_date.`
          );
        if (term.isActive !== undefined && typeof term.isActive !== 'boolean')
            throw new Error(`Term "${term.label}" isActive must be a boolean if provided.`);
      });
      return true;
    }),
  handleValidationErrors,
];

// Validation for deleting a session by ID.
export const validateDeleteSession = [
  param("id")
    .trim()
    .notEmpty()
    .withMessage("Session ID is required")
    .isString()
    .withMessage("Session ID must be a string")
    .isLength({ max: 50 }).withMessage("Session ID max length is 50"),
  handleValidationErrors,
];

/**
 * Validation rules for creating a new class.
 * - `label`: Name of the class (e.g., "Grade 10").
 * - `section`: Optional comma-separated string of section labels (e.g., "A,B,C").
 * - `schoolId`: Array of school IDs where this class will be created.
 * - `teacherId`: Optional ID of a teacher to be assigned (e.g., as a default class teacher for new sections).
 */
export const validateCreateClass = [
  body("label")
    .notEmpty()
    .withMessage("Label is required")
    .isString()
    .withMessage("Label must be a string")
    .isLength({ max: 100 }).withMessage("Class label max length is 100"),
  body("section") // Comma-separated string of section labels.
    .optional()
    .isString().withMessage("Section, if provided, must be a string of comma-separated labels.")
    .trim()
    .isLength({ max: 500 }).withMessage("Section string max length is 500.")
    .custom((value: string) => { // Validates each individual section label within the string.
      if (value === '') return true;
      const sections = value.split(",").map(sec => sec.trim());
      if (!sections.every(sec => sec.length > 0 && sec.length <= 50)) {
        throw new Error("Each section label (comma-separated) must be 1-50 characters long.");
      }
      if (sections.some(sec => !/^[a-zA-Z0-9\s_.-]+$/.test(sec))) { // Basic character set for labels.
           throw new Error("Section labels can only contain alphanumeric characters, spaces, underscores, dots, or hyphens.");
      }
      return true;
    }),
  body("schoolId") // Expects an array of school IDs.
    .notEmpty().withMessage("At least one School ID is required.")
    .isArray({ min: 1 }).withMessage("schoolId must be an array with at least one ID.")
    .custom((value: string[]) => { // Validates each school ID in the array.
      if (!value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 50)) {
        throw new Error("Each school ID must be a valid string with max length 50.");
      }
      return true;
    }),
  body("teacherId")
    .optional()
    .isString()
    .withMessage("Teacher ID must be a string")
    .isLength({ max: 50 }).withMessage("Teacher ID max length is 50"),

  handleValidationErrors,
];

// Validation rules for updating an existing class.
export const validateUpdateClass = [
  param("id") // Class ID from URL parameter.
    .notEmpty()
    .withMessage("Class ID is required")
    .isString()
    .withMessage("Class ID must be a string")
    .isLength({ max: 50 }).withMessage("Class ID max length is 50"),
  body("label").optional().isString().withMessage("Label must be a string").isLength({ max: 100 }).withMessage("Label max length is 100"),
  // Section updates are handled by specific logic in controller; `section` field here might update all sections or specific ones.
  // The controller's `updateClass` has specific logic for section string processing.
  body("section")
    .optional()
    .isString().withMessage("Section, if provided, must be a string of comma-separated labels.")
    .trim()
    .isLength({ max: 500 }).withMessage("Section string max length is 500.")
    .custom((value: string) => {
        if (value === '') return true;
        const sections = value.split(",").map(sec => sec.trim());
        if (!sections.every(sec => sec.length > 0 && sec.length <= 50)) {
            throw new Error("Each section label (comma-separated) must be 1-50 characters long.");
        }
        if (sections.some(sec => !/^[a-zA-Z0-9\s_.-]+$/.test(sec))) {
            throw new Error("Section labels can only contain alphanumeric characters, spaces, underscores, dots, or hyphens.");
        }
        return true;
    }),
  body("teacherId") // Optional: if provided, might apply to newly created sections during update.
    .optional()
    .isString()
    .withMessage("Teacher ID must be a string")
    .isLength({ max: 50 }).withMessage("Teacher ID max length is 50"),
  handleValidationErrors,
];

// Validation rules for transferring a student.
export const validateTransferStudent = [
  // Assuming studentId here refers to a single student ID for the transfer operation.
  // If batch transfer of multiple students is intended, this should be an array.
  // Current controller logic for transferStudent seems to process `studentId` as an array.
  // Adjusting validator to expect an array to match controller.
  body("studentId")
    .notEmpty().withMessage("Student ID(s) are required.")
    .isArray({ min: 1 }).withMessage("studentId must be an array with at least one ID.")
    .custom((value: string[]) => {
      if (!value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 50)) {
        throw new Error("Each student ID must be a valid string with max length 50.");
      }
      return true;
    }),
  body("toSchoolId")
    .notEmpty()
    .withMessage("To school ID is required")
    .isString()
    .withMessage("To school ID must be a string")
    .isLength({ max: 50 }).withMessage("To school ID max length is 50"),
  body("toClassId")
    .notEmpty()
    .withMessage("To Class ID is required")
    .isString()
    .withMessage("To Class ID must be a string")
    .isLength({ max: 50 }).withMessage("To Class ID max length is 50"),
  body("toSectionId")
    .notEmpty()
    .withMessage("To Section ID is required")
    .isString()
    .withMessage("To Section ID must be a string")
    .isLength({ max: 50 }).withMessage("To Section ID max length is 50"),
  body("transferReason")
    .optional()
    .isString()
    .withMessage("Transfer reason must be a string")
    .isLength({ max: 1000 }).withMessage("Transfer reason max length is 1000"),
  handleValidationErrors,
];

// Validation rules for enrolling a student (seems to be for a single student).
export const validateEnrollStudent = [
  body("studentId")
    .notEmpty()
    .withMessage("Student ID is required")
    .isString()
    .withMessage("Student ID must be a string")
    .isLength({ max: 50 }).withMessage("Student ID max length is 50"),
  body("classId")
    .notEmpty()
    .withMessage("Class ID is required")
    .isString()
    .withMessage("Class ID must be a string")
    .isLength({ max: 50 }).withMessage("Class ID max length is 50"),
  body("sectionId")
    .notEmpty()
    .withMessage("Section ID is required")
    .isString()
    .withMessage("Section ID must be a string")
    .isLength({ max: 50 }).withMessage("Section ID max length is 50"),
  handleValidationErrors,
];

// Validation rules for promoting student(s).
export const validatePromoteStudent = [
  // Controller expects studentId to be an array.
  body("studentId")
    .notEmpty().withMessage("Student ID(s) are required.")
    .isArray({min: 1}).withMessage("studentId must be an array with at least one ID.")
    .custom((value: string[]) => {
      if (!value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 50)) {
        throw new Error("Each student ID must be a valid string with max length 50.");
      }
      return true;
    }),
  body("fromClassId") // Might be derived backend-side based on student's current enrollment.
    .optional()
    .isString()
    .withMessage("From class ID must be a string")
    .isLength({ max: 50 }).withMessage("From class ID max length is 50"),
  body("toClassId")
    .notEmpty()
    .withMessage("To class ID is required")
    .isString()
    .withMessage("To class ID must be a string")
    .isLength({ max: 50 }).withMessage("To class ID max length is 50"),
  body("sectionId") // Target section ID in the new class.
    .notEmpty()
    .withMessage("Target Section ID is required")
    .isString()
    .withMessage("Section ID must be a string")
    .isLength({ max: 50 }).withMessage("Section ID max length is 50"),
  handleValidationErrors,
];

// Validation rules for sending bulk messages.
export const validateSendBulkMessage = [
  body("recipients") // Object defining target recipients (e.g., by IDs, class, school).
    .notEmpty()
    .withMessage("Recipients are required")
    .isObject()
    .withMessage("Recipients must be an object"),
  body("recipients.staffIds") // Optional array of staff IDs.
    .optional()
    .isArray()
    .withMessage("Staff IDs must be an array of strings")
    .custom((value: string[]) => {
      if (value && !value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 50)) {
        throw new Error("Each staffId ID must be a valid string with max length 50.");
      }
      return true;
    }),
  body("recipients.studentIds") // Optional array of student IDs.
    .optional()
    .isArray()
    .withMessage("Student IDs must be an array of strings")
    .custom((value: string[]) => {
      if (value && !value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 50)) {
        throw new Error("Each student ID must be a valid string with max length 50.");
      }
      return true;
    }),
  body("recipients.classId") // Optional class ID to target all students in a class.
    .optional()
    .isString()
    .withMessage("Class ID must be a string")
    .isLength({ max: 50 }).withMessage("Class ID max length is 50"),
  body("recipients.schoolId") // Optional school ID to target all students/staff in a school.
    .optional()
    .isString()
    .withMessage("School ID must be a string")
    .isLength({ max: 50 }).withMessage("School ID max length is 50"),
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isString()
    .withMessage("Title must be a string")
    .isLength({ max: 255 }).withMessage("Title max length is 255"),
  body("message")
    .notEmpty()
    .withMessage("Message is required")
    .isString()
    .withMessage("Message must be a string")
    .isLength({ max: 5000 }).withMessage("Message max length is 5000"),
  body("category") // Message category, validated against NotificationCategory enum.
    .notEmpty()
    .withMessage("Category is required")
    .isString()
    .isLength({ max: 50 }).withMessage("Category max length is 50")
    .isIn(Object.values(NotificationCategory))
    .withMessage(`Category must be one of: ${Object.values(NotificationCategory).join(", ")}`),
  body("channels") // Array of channels (EMAIL, IN_APP, BOTH), validated against NotificationType enum.
    .isArray({min: 1})
    .withMessage("Channels must be a non-empty array")
    .custom((value: string[]) => { // Validates each channel against NotificationType enum values.
        if (!value.every(channel => Object.values(NotificationType).includes(channel as NotificationType))) {
            throw new Error(`Channels must be one or more of: ${Object.values(NotificationType).join(", ")}`);
        }
        return true;
    }),
  body("scheduledAt") // Optional: if provided, message is scheduled for later delivery.
    .optional()
    .isISO8601()
    .withMessage("Scheduled time must be a valid ISO 8601 date"),
  handleValidationErrors,
];

// Validation rules for fetching notifications for a user (query parameters).
export const validateGetNotificationsForUser = [
  query("category") // Optional filter by notification category.
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .isLength({ max: 50 }).withMessage("Category max length is 50")
    .isIn(Object.values(NotificationCategory)) // Validates against NotificationCategory enum.
    .withMessage(`Category must be one of: ${Object.values(NotificationCategory).join(", ")}`),
  query("status").optional().isString().withMessage("Status must be a string").isLength({ max: 20 }).withMessage("Status max length is 20"), // e.g., "read", "unread"
  query("startDate") // Optional filter for notification creation date range.
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),
  query("endDate") // Optional filter for notification creation date range.
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),
  handleValidationErrors,
];
