import { Request } from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_TOKEN_EXPIRES_IN } from "../config/constants"; // Added import

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
export const generateToken = (payload: Omit<TokenPayload, 'jti'> & { expire?: string }): string => {
  const expiresIn = payload.expire || DEFAULT_TOKEN_EXPIRES_IN; // Used constant
  const jwtId = uuidv4(); // Generate a unique JWT ID (JTI)

  // Sign the token with user ID and JTI.
  // The `jwtid` option in `jwt.sign` sets the standard `jti` claim in the token.
  // We also include `jti` in our internal payload structure for consistency if ever needed,
  // though standard libraries primarily rely on the claim itself.
  return jwt.sign({ id: payload.id, jti: jwtId }, JWT, {
    expiresIn,
    jwtid: jwtId
  });
};

/**
 * Decodes a JWT string and returns its payload.
 * Handles potential verification errors by returning null.
 * @param token - The JWT string to decode.
 * @returns The decoded token payload (including id, jti, iat, exp) or null if verification fails.
 */
export const decodeToken = (token: string): TokenPayload & { iat: number, exp: number } | null => {
  try {
    // Verify the token and type assert to include standard JWT claims (iat, exp)
    // along with our custom TokenPayload fields.
    const decoded = jwt.verify(token, JWT) as TokenPayload & {iat: number, exp: number};
    return decoded;
  } catch (error) {
    // Invalid token (e.g., malformed, expired, signature mismatch).
    // Server-side logging of this error can be done here or in the calling function if needed.
    // logger.warn({ err: error, tokenAttempted: token }, "Failed to decode or verify token");
    return null;
  }
};

/**
 * Extracts and decodes the JWT from an Express request's Authorization header.
 * @param req - The Express request object.
 * @returns The decoded token payload or null if the token is missing, malformed, or invalid.
 */
export const getDecodedTokenFromRequest = (req: Request): TokenPayload & { iat: number, exp: number } | null => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      // No Authorization header present.
      return null;
    }

    const parts = authHeader.split(" ");
    // Expecting "Bearer <token>" format.
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      // Invalid format.
      // logger.warn({ authHeaderFormat: authHeader }, "Invalid authorization header format");
      return null;
    }

    const token = parts[1];
    return decodeToken(token);
  } catch (error: any) {
    // This catch block is more for unexpected errors during header processing,
    // as decodeToken itself handles JWT verification errors and returns null.
    // logger.error({ err: error }, "Unexpected error in getDecodedTokenFromRequest");
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
