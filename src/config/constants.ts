import { UserRole } from "@prisma/client";

// Token Expiry
export const DEFAULT_TOKEN_EXPIRES_IN = "1d";
export const SENSITIVE_ROLE_TOKEN_EXPIRES_IN = "1h";

// OTP Expiry
export const OTP_EXPIRY_SECONDS = 15 * 60; // 900 seconds

// Rate Limiting Parameters (OTP)
export const OTP_VERIFY_WINDOW_SECONDS = 15 * 60; // 15 minutes
export const OTP_VERIFY_MAX_ATTEMPTS = 5;
export const OTP_RESEND_WINDOW_SECONDS = 60 * 60; // 1 hour
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
export const DEFAULT_REDIS_CACHE_EXPIRY_SECONDS = 5 * 60; // 5 minutes (300 seconds)

// Sensitive User Roles for token expiry, etc.
export const SENSITIVE_USER_ROLES: ReadonlyArray<UserRole> = [
    UserRole.super_admin,
    UserRole.admin,
    UserRole.finance
];

// Example of other constants that could be added:
// export const MIN_PASSWORD_LENGTH = 6;
// export const MAX_PASSWORD_LENGTH = 128;
// export const MAX_EMAIL_LENGTH = 254;
// export const MAX_GENERAL_NAME_LENGTH = 100;
