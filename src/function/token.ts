import { Request } from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_TOKEN_EXPIRES_IN } from "../config/constants";

/**
 * Generates a random numeric OTP of specified length
 * @param length - The length of OTP to generate (default: 6)
 * @returns The generated OTP string
 */
export const generateOTP = (length: number = 6): string => {
  // Ensure length is between 4 and 8 digits
  const validLength = Math.min(Math.max(length, 4), 8);

  // Generate random numbers and pad with leading zeros if needed
  const otp = Math.floor(Math.random() * Math.pow(10, validLength))
    .toString()
    .padStart(validLength, "0");

  return otp;
};

/**
 * Defines the structure of the JWT payload.
 * @property id - The user ID.
 * @property expire - Optional: Custom expiration time string (e.g., "1h", "7d").
 * @property jti - Optional: JWT ID, used for token revocation.
 */
interface TokenPayload {
  id: string;
  expire?: string;
  jti?: string;
}

// JWT secret key, ensured to be string by type assertion.
const JWT = process.env.JWT_SECRET_KEY as string;

/**
 * Generates a JWT for a given user ID.
 * Includes a JTI (JWT ID) claim for potential revocation.
 * @param payload - Object containing the user ID and an optional custom expiration.
 * @param payload.id - The user's unique identifier.
 * @param payload.expire - Optional: A string describing the token expiry (e.g., "1h", "7d"). Defaults to `DEFAULT_TOKEN_EXPIRES_IN`.
 * @returns The generated JWT string.
 */
export const generateToken = (
  payload: Omit<TokenPayload, "jti"> & { expire?: string }
): string => {
  const expiresIn = payload.expire || DEFAULT_TOKEN_EXPIRES_IN;
  const jwtId = uuidv4();

  return jwt.sign({ id: payload.id }, JWT, {
    expiresIn,
    jwtid: jwtId,
  });
};

/**
 * Decodes a JWT string and returns its payload.
 * Handles potential verification errors by returning null.
 * @param token - The JWT string to decode.
 * @returns The decoded token payload (including id, jti, iat, exp) or null if verification fails.
 */
export const decodeToken = (
  token: string
): (TokenPayload & { iat: number; exp: number }) | null => {
  try {
    const decoded = jwt.verify(token, JWT) as TokenPayload & {
      iat: number;
      exp: number;
    };
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Extracts and decodes the JWT from an Express request's Authorization header.
 * @param req - The Express request object.
 * @returns The decoded token payload or null if the token is missing, malformed, or invalid.
 */
export const getDecodedTokenFromRequest = (
  req: Request
): (TokenPayload & { iat: number; exp: number }) | null => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    const token = parts[1];
    return decodeToken(token);
  } catch (error: any) {
    return null;
  }
};

/**
 * Retrieves the user ID from the token in an Express request.
 * This function is kept for some backward compatibility and acts as a convenience wrapper
 * around `getDecodedTokenFromRequest`. It is recommended to phase out its direct use
 * in favor of `getDecodedTokenFromRequest` where the full payload (including JTI) is needed.
 * @param req - The Express request object.
 * @returns The user ID string or null if the token is invalid or ID cannot be extracted.
 */
export const getIdFromToken = (req: Request): string | null => {
  const decodedPayload = getDecodedTokenFromRequest(req);
  return decodedPayload ? decodedPayload.id : null;
};
