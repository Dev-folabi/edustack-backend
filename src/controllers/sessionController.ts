import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { SessionRequest, TermData } from "../types/requests/index"; // Assuming TermData might be part of SessionRequest or defined elsewhere
import { handleError } from "../error/errorHandler";
import { paginateResults } from "../function/pagination";
import logger from "../utils/logger";

/**
 * Creates a new academic session along with its associated terms.
 * If the new session is marked as active, any existing active session will be deactivated.
 * Term start dates must be before their end dates, and session start date must be before its end date.
 * @route POST /api/session (example route)
 * @param req - Express request object. Body should conform to `SessionRequest`.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
export const createSessionWithTerms = async (
  req: Request<{}, {}, SessionRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { label, start_date, end_date, isActive, terms } = req.body;

    // Validate session dates
    if (new Date(start_date) >= new Date(end_date)) {
      return handleError(res, "The session's start date must be earlier than its end date.", 400);
    }

    // Validate terms array and individual term dates
    if (!terms || terms.length === 0) {
      return handleError(res, "At least one term must be provided for the session.", 400);
    }
    for (const term of terms) {
      if (new Date(term.start_date) >= new Date(term.end_date)) {
        // This specific validation is also present in `Validators.ts`.
        // Redundant check here provides an early exit if somehow bypassed or for direct API calls not using validator.
        return handleError(res, `Term '${term.label}' has invalid start and end dates: start_date must be earlier than end_date.`, 400);
      }
    }

    const currentDate = new Date(); // Used for determining if a new term should be initially active.

    // Perform operations within a transaction for atomicity.
    const result = await prisma.$transaction(async (tx) => {
      // If the new session is set to active, deactivate any currently active session.
      if (isActive) {
        const updatedSessions = await tx.session.updateMany({ where: { isActive: true }, data: { isActive: false } });
        if (updatedSessions.count > 0) {
            logger.info({ deactivatedCount: updatedSessions.count }, "Deactivated existing active sessions.");
        }
      }

      // Create the new session.
      const session = await tx.session.create({
        data: { label, start_date: new Date(start_date), end_date: new Date(end_date), isActive },
      });
      logger.info({ sessionId: session.id, label: session.label, isActive: session.isActive }, "New session created.");

      // Create all terms associated with this session.
      const createdTerms = await Promise.all(
        terms.map((term) =>
          tx.term.create({
            data: {
              sessionId: session.id,
              label: `${term.label}`,
              start_date: new Date(term.start_date),
              end_date: new Date(term.end_date),
              // Term is active if its date range includes the current date,
              // or as specified in request (though `term.isActive` wasn't in SessionRequest initially).
              // For now, using date range. If `term.isActive` is added to `TermData`, it can be used.
              isActive: term.isActive !== undefined ? term.isActive :
                        (new Date(term.start_date) <= currentDate && new Date(term.end_date) >= currentDate),
            },
          })
        )
      );
      logger.info({ sessionId: session.id, termCount: createdTerms.length }, "Terms created for session.");

      return { session, createdTerms };
    });

    res.status(201).json({
      success: true,
      message: "Session and terms created successfully.",
      data: result,
    });
  } catch (error: any) {
    next(error); // Pass to global error handler.
  }
};

/**
 * Retrieves the currently active academic session and its terms.
 * Assumes only one session can be active at a time.
 * @route GET /api/session/active (example route)
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
export const getSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // findFirst is more appropriate if only one active session is expected.
    const activeSession = await prisma.session.findFirst({
      where: { isActive: true },
      include: {
        terms: { orderBy: { start_date: 'asc' } }, // Order terms by start date
      },
    });

    if (!activeSession) {
        logger.info("No active session found.");
        // It's debatable whether this is a 404. Client might expect an empty result or specific status.
        return res.status(200).json({success: true, message: "No active session found.", data: null});
    }

    res.status(200).json({
      success: true,
      message: "Active session retrieved successfully.",
      data: activeSession,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Retrieves all academic sessions along with their terms, paginated.
 * @route GET /api/session/all (example route)
 * @param req - Express request object. Query params for pagination: `page`, `limit`.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
export const getAllSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query?.page as string, 10) || 1;
    const limit = parseInt(req.query?.limit as string, 10) || 10;

    const sessions = await prisma.session.findMany({
      include: {
        terms: { orderBy: { start_date: 'asc' } },
      },
      orderBy: {
        start_date: 'desc', // Show latest sessions first
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalRecords = await prisma.session.count();

    res.status(200).json({
      success: true,
      message: "All sessions retrieved successfully.",
      data: paginateResults(sessions, page, limit, totalRecords),
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Retrieves a specific academic session by its ID, including its terms.
 * @route GET /api/session/:id (example route)
 * @param req - Express request object. Param `id` is the session ID.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
export const getSessionById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.params.id;
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        terms: { orderBy: { start_date: 'asc' } },
      },
    });

    if (!session) {
      return handleError(res, "Session doesn't exist.", 404);
    }

    res.status(200).json({
      success: true,
      message: "Session retrieved successfully.",
      data: session,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Updates an existing academic session and its terms.
 * Allows updating session details (label, dates, active status) and upserting terms.
 * If a session is marked active, other active sessions are deactivated.
 * @route PUT /api/session/:id (example route)
 * @param req - Express request object. Param `id` is session ID. Body for updates.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
export const updateSessionWithTerms = async (
  req: Request<{ id: string }, {}, Partial<SessionRequest>>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { label, start_date, end_date, isActive, terms } = req.body;
    const sessionId = req.params.id;

    // Validate session dates if both are provided for update
    if (start_date && end_date && new Date(start_date) >= new Date(end_date)) {
      return handleError(res, "Session start date must be earlier than end date.", 400);
    }
    // Validate individual term dates if terms are provided
    if (terms) {
      for (const term of terms) { // Using for...of for early exit on error
        if (term.start_date && term.end_date && new Date(term.start_date) >= new Date(term.end_date)) {
          return handleError(res, `Term '${term.label}' has invalid dates: start_date must be earlier than end_date.`, 400);
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingSession = await tx.session.findUnique({ where: {id: sessionId }});
      if (!existingSession) {
          // This specific error will be caught by the main catch and logged by the global error handler.
          throw new Error("Session to update not found.");
      }

      // If this session is being set to active AND it's not already active.
      if (isActive === true && !existingSession.isActive) {
        await tx.session.updateMany({
          where: { isActive: true, NOT: { id: sessionId } },
          data: { isActive: false },
        });
        logger.info({ newlyActivatedSessionId: sessionId }, "Deactivated other active sessions during update.");
      }

      // Update the session details. Only update fields that are provided.
      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: {
          label: label !== undefined ? label : existingSession.label,
          start_date: start_date !== undefined ? new Date(start_date) : existingSession.start_date,
          end_date: end_date !== undefined ? new Date(end_date) : existingSession.end_date,
          isActive: isActive !== undefined ? isActive : existingSession.isActive,
        },
      });
      logger.info({ sessionId: updatedSession.id }, "Session details updated.");

      let updatedOrCreatedTerms: any[] = []; // Use a more specific type if Term type is available
      if (terms) {
        // Upsert (update or create) each term provided in the request.
        updatedOrCreatedTerms = await Promise.all(
            terms.map((term: TermData) => { // Assuming TermData type for term object
              const termPayload = {
                sessionId: updatedSession.id,
                label: term.label,
                start_date: new Date(term.start_date),
                end_date: new Date(term.end_date),
                isActive: term.isActive !== undefined ? term.isActive : false,
              };
              return tx.term.upsert({
                where: { id: term.id || "" }, // If ID is missing or empty, it's a create.
                create: termPayload,
                update: { // Update only fields that are actually part of TermData and meant to be updatable
                    label: term.label !== undefined ? term.label : undefined,
                    start_date: term.start_date !== undefined ? new Date(term.start_date) : undefined,
                    end_date: term.end_date !== undefined ? new Date(term.end_date) : undefined,
                    isActive: term.isActive !== undefined ? term.isActive : undefined,
                },
              });
            })
          );
        logger.info({ sessionId: updatedSession.id, termCount: updatedOrCreatedTerms.length }, "Terms upserted for session.");
      }
      return { updatedSession, updatedTerms: updatedOrCreatedTerms };
    });

    res.status(200).json({
      success: true,
      message: "Session and terms updated successfully.",
      data: {
        session: result.updatedSession,
        terms: result.updatedTerms,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Deletes an academic session and its associated terms.
 * An active session cannot be deleted.
 * @route DELETE /api/session/:id (example route)
 * @param req - Express request object. Param `id` is the session ID.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
export const deleteSession = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.params.id;
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return handleError(res, "Session doesn't exist.", 404);
    }

    // Prevent deletion of an active session. It must be deactivated first.
    if (session.isActive) {
      logger.warn({ sessionId }, "Attempt to delete active session denied.");
      return handleError(res, "Cannot delete an active session. Deactivate it first.", 400);
    }

    // Perform deletion of terms and then the session within a transaction.
    await prisma.$transaction(async (tx) => {
      await tx.term.deleteMany({ where: { sessionId: sessionId } });
      await tx.session.delete({ where: { id: sessionId } });
    });
    logger.info({ sessionId }, "Session and associated terms deleted successfully.");

    res.status(200).json({
      success: true,
      message: "Session and associated terms deleted successfully.",
    });
  } catch (error: any) {
    // Specific check for foreign key constraint errors if session is still referenced
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        logger.error({err: error, sessionId}, "Failed to delete session due to foreign key constraint. It might be linked to enrollments or promotion histories.");
        return handleError(res, "Cannot delete session. It is still referenced by other records (e.g., student enrollments, promotion history). Please remove these references first.", 400);
    }
    next(error);
  }
};

/**
 * Retrieves all academic terms across all sessions, paginated.
 * @route GET /api/term/all (example route)
 * @param req - Express request object. Query params for pagination: `page`, `limit`.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
export const getAllTerms = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query?.page as string, 10) || 1;
    const limit = parseInt(req.query?.limit as string, 10) || 10;

    const terms = await prisma.term.findMany({
        orderBy:{ start_date: 'desc' }, // Order by start date
        skip: (page - 1) * limit,
        take: limit,
    });
    const totalRecords = await prisma.term.count();

    res.status(200).json({
      success: true,
      message: "All terms retrieved successfully.",
      data: paginateResults(terms, page, limit, totalRecords),
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Retrieves a specific academic term by its ID.
 * @route GET /api/term/:id (example route)
 * @param req - Express request object. Param `id` is the term ID.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 */
export const getTermById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const termId = req.params.id;
    const term = await prisma.term.findUnique({
      where: { id: termId },
    });

    if (!term) {
      return handleError(res, "Term doesn't exist.", 404);
    }

    res.status(200).json({
      success: true,
      message: "Term retrieved successfully.",
      data: term,
    });
  } catch (error: any) {
    next(error);
  }
};
