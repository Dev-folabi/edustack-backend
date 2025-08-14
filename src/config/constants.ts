import { UserRole } from "@prisma/client";

// Token Expiry
export const DEFAULT_TOKEN_EXPIRES_IN = "1d";
export const SENSITIVE_ROLE_TOKEN_EXPIRES_IN = "1h";

// OTP Expiry
export const OTP_EXPIRY_SECONDS = 15 * 60;

// Rate Limiting Parameters (OTP)
export const OTP_VERIFY_WINDOW_SECONDS = 15 * 60;
export const OTP_VERIFY_MAX_ATTEMPTS = 5;
export const OTP_RESEND_WINDOW_SECONDS = 60 * 60;
export const OTP_RESEND_MAX_ATTEMPTS = 3;

// School Creation Limit
export const MAX_SCHOOL_CREATION_LIMIT = 3;

// Redis Key Prefixes - Standardized for consistency
export const REDIS_DENYLIST_PREFIX = "denylist_jti:";
export const REDIS_RATE_LIMIT_PREFIX = "rate_limit:";
export const REDIS_EMAIL_VERIFICATION_PREFIX = "email_verification_";
export const REDIS_PASSWORD_RESET_PREFIX = "password_reset_";

// Default Pagination Values
export const DEFAULT_PAGE_NUMBER = 1;
export const DEFAULT_PAGE_LIMIT = 10;

// Default Cache Expiry for general items in Redis
export const DEFAULT_REDIS_CACHE_EXPIRY_SECONDS = 5 * 60;

// Sensitive User Roles for token expiry, etc.
export const SENSITIVE_USER_ROLES: ReadonlyArray<UserRole> = [
  UserRole.super_admin,
  UserRole.admin,
  UserRole.finance,
];

export const SUPER_ADMIN_ROLES: ReadonlyArray<UserRole> = [
  UserRole.super_admin,
  UserRole.edustack,
];

export const ADMIN_ROLES: ReadonlyArray<UserRole> = [
  UserRole.super_admin,
  UserRole.admin,
  UserRole.edustack,
];

export const STAFF_ROLES: ReadonlyArray<UserRole> = [
  UserRole.edustack,
  UserRole.admin,
  UserRole.teacher,
  UserRole.librarian,
];

export const STUDENT_ROLES: ReadonlyArray<UserRole> = [
  UserRole.edustack,
  UserRole.student,
];

export const TEACHER_ROLES: ReadonlyArray<UserRole> = [
  UserRole.admin,
  UserRole.edustack,
  UserRole.teacher,
];

export const LIBRARIAN_ROLES: ReadonlyArray<UserRole> = [
  UserRole.admin,
  UserRole.edustack,
  UserRole.librarian,
];

export const FINANCE_ROLES: ReadonlyArray<UserRole> = [
  UserRole.admin,
  UserRole.edustack,
  UserRole.finance,
];

export const PARENT_ROLES: ReadonlyArray<UserRole> = [
  UserRole.admin,
  UserRole.edustack,
  UserRole.parent,
];

export const ATTENDANCE_TYPE = {
  STUDENT: "STUDENT",
  STAFF: "STAFF"
} as const;
