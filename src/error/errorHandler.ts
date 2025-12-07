import { Prisma } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * Global error handler middleware for the Express application.
 * It categorizes errors (Prisma known errors, initialization errors, validation errors, and other generic errors)
 * and sends a standardized JSON response to the client.
 * Detailed error information is logged server-side for debugging.
 *
 * @param error - The error object. Can be of any type.
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The Express next function (unused in this handler as it's terminal for error responses).
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const metaTarget = (error.meta?.target as string[] | string)?.toString();

  // Handle Prisma Client Known Request Errors (e.g., unique constraint violation, record not found)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const logContext = { err: error, prismaCode: error.code, metaTarget, path: req.path, method: req.method, body: req.body, query: req.query };
    let clientMessage = "An unexpected database error occurred.";
    let statusCode = 500;
    let data: any = undefined; // Data to be sent to client, only for specific safe cases

    switch (error.code) {
      case "P1001": // Can't reach database server
        logger.error(logContext, `Prisma Error ${error.code}: Can't reach database server.`);
        statusCode = 503; // Service Unavailable
        clientMessage = "Cannot connect to the database service. Please try again later.";
        break;
      case "P2000": // Value too long for column
        logger.error(logContext, `Prisma Error ${error.code}: Input value too long.`);
        statusCode = 400;
        clientMessage = "Input value is too long for the specified field(s).";
        // error.meta.target (or column_name in some versions) indicates the problematic field(s).
        data = error.meta?.target ? { field: error.meta.target } : (error.meta?.column_name ? { field: error.meta.column_name } : undefined);
        break;
      case "P2001": // Record not found (where clause)
        logger.error(logContext, `Prisma Error ${error.code}: Record not found based on where clause.`);
        statusCode = 404;
        clientMessage = "The requested record was not found.";
        break;
      case "P2002": // Unique constraint violation
        logger.error(logContext, `Prisma Error ${error.code}: Unique constraint violation.`);
        statusCode = 409; // Conflict
        clientMessage = "A record with the provided information already exists.";
        // error.meta.target usually lists the field(s) causing the unique constraint violation.
        data = error.meta?.target ? { conflictingFields: error.meta.target } : undefined;
        break;
      case "P2003": // Foreign key constraint failed

        { const fieldName = (error.meta?.field_name as string) || metaTarget;
        logger.error(logContext, `Prisma Error ${error.code}: Foreign key constraint failed. Field: ${fieldName}.`);
        statusCode = 400; // Bad Request (or 409 Conflict)
        clientMessage = `An operation failed due to a data integrity issue with field: ${fieldName}. Ensure related records exist.`;
        data = fieldName ? { field: fieldName } : undefined;
        break; }
      case "P2004": // A constraint failed on the database (more generic)
        logger.error(logContext, `Prisma Error ${error.code}: A database constraint failed.`);
        statusCode = 400;
        clientMessage = "A database constraint was violated.";
        break;
      case "P2007": // Data validation error (e.g. invalid enum, wrong type for JSON field)
        logger.error(logContext, `Prisma Error ${error.code}: Data validation error.`);
        statusCode = 400;
        clientMessage = "Invalid data format provided for a field.";
        break;
      case "P2011": // Null constraint violation
        logger.error(logContext, `Prisma Error ${error.code}: Null constraint violation.`);
        statusCode = 400;
        clientMessage = `A required field was missing or null: ${metaTarget || 'details unavailable'}.`;
        data = error.meta?.target ? { missingFields: error.meta.target } : undefined;
        break;
      case "P2014": // Relation violation (e.g. trying to disconnect a required relation)
        logger.error(logContext, `Prisma Error ${error.code}: Relation violation.`);
        statusCode = 400;
        clientMessage = "The attempted change would violate a relationship between records.";
        break;
      case "P2015": // Related record not found
        logger.error(logContext, `Prisma Error ${error.code}: Related record not found.`);
        statusCode = 404; // Or 400 if it's due to bad input for the relation
        clientMessage = "A related record necessary for this operation was not found.";
        break;
      case "P2025": // Record to operate on does not exist (e.g. update or delete a non-existent record)
        logger.error(logContext, `Prisma Error ${error.code}: Record to operate on does not exist.`);
        statusCode = 404;
        clientMessage = "The target record for the operation does not exist.";
        // error.meta.cause might have more info, but usually not safe for client
        break;

      // Generic catch for other P1xxx (connection/pool), P3xxx (migration) errors
      case "P1000":
      case "P1002":
        logger.error(logContext, `Prisma Error ${error.code}: Database connection/authentication error.`);
        statusCode = 503; // Service Unavailable for connection issues
        clientMessage = "A database connection or authentication error occurred.";
        break;
      default: // Catch-all for other Prisma KnownRequestErrors
        logger.error(logContext, `Prisma Error ${error.code}: Unhandled Prisma Known Error.`);
        clientMessage = `An unexpected database error occurred (Code: ${error.code}).`;
        // No 'data' from error.meta by default for unhandled codes to avoid leaks.
        break;
    }
    return res.status(statusCode).json({ success: false, message: clientMessage, data });
  }

  // Handle Prisma Client Initialization Errors (e.g., bad database URL, credentials)
  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error({ err: error, errorCode: error.errorCode, clientVersion: error.clientVersion }, "Prisma Client Initialization Error");
    return res.status(503).json({ // Service Unavailable
      success: false,
      message: "Failed to initialize database service. Please try again later.",
    });
  }

  // Handle Prisma Client Validation Errors (e.g., missing required field in query, wrong type)
  if (error instanceof Prisma.PrismaClientValidationError) {
    // These errors occur when the query itself is malformed based on the schema (e.g. providing wrong type for a field).
    // The error.message is usually quite detailed and can be long, sometimes exposing model structure.
    logger.error({ err: error, path: req.path, method: req.method, body: req.body }, "Prisma Client Validation Error (Query construction issue)");
    return res.status(400).json({ // Bad Request
      success: false,
      message: "Invalid input data. Please check the format and types of your provided values.",
      // Details could be a sanitized version of error.message if needed, but often too revealing.
    });
  }

  // Handle other non-Prisma errors (generic catch-all for unexpected errors)
  logger.error({ err: error, path: req.path, method: req.method, body: req.body, query: req.query }, "Unhandled Error caught by global error handler");

  const clientMessage = "An unexpected internal server error occurred.";
  // Use error.status if it's a custom error with a status property, otherwise default to 500.
  const statusCode = typeof error.status === 'number' && error.status >= 400 && error.status < 600 ? error.status : 500;

  return res.status(statusCode).json({
    success: false,
    message: clientMessage,
    // No 'data' field here to prevent leaking any details from unknown error types.
  });
};

/**
 * A local helper function for sending standardized error responses from controllers
 * before an error is thrown or passed to `next()`.
 * Note: This function does not perform logging itself; logging should be done
 * by the caller or by the main `errorHandler` if `next(error)` is used.
 *
 * @param res - The Express response object.
 * @param message - The error message to send to the client.
 * @param status - The HTTP status code. Defaults to 400.
 * @param data - Optional additional data to include in the response. Defaults to null.
 */
export const handleError = (
  res: Response,
  message: string,
  status = 400,
  data: any = null
) => {
  res.status(status).json({ success: false, message, data });
};
