import { Request } from "express";
import jwt from "jsonwebtoken";

interface TokenPayload {
  id: string;
  expire?: string;
}
const JWT = process.env.JWT_SECRET_KEY as string;

export const generateToken = (payload: TokenPayload): string => {
  const expiresIn = payload.expire || "1d";
  return jwt.sign({ id: payload.id }, JWT, {
    expiresIn,
  });
};

export const decodeToken = (token: string): string => {
  try {
    const decoded = jwt.verify(token, JWT) as TokenPayload;
    return decoded.id;
  } catch (error) {
    throw new Error("Invalid token");
  }
};

export const getIdFromToken = (req: Request): string => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new Error("Invalid authorization header format");
    }

    const token = parts[1];
    const decoded = jwt.verify(token, JWT) as TokenPayload;
    return decoded.id;
  } catch (error: any) {
    throw new Error(`Invalid token sent`);
  }
};
