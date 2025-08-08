import express from "express";
import {
  createSessionWithTerms,
  deleteSession,
  getAllSessions,
  getSession,
  getSessionById,
  getAllTerms,
  getTermById,
  updateSessionWithTerms,
  deleteTerm,
} from "../../controllers/sessionController";
import {
  validateCreateSession,
  validateUpdateSession,
  validateDeleteSession,
  validateDeleteTerm,
} from "../../middlewares/Validators";
import { roleAuthorization } from "../../middlewares/authorization";

const router = express.Router();

/**
 * @route POST /
 * @description Create a new session along with its terms
 * @access Super Admin only
 * @middleware roleAuthorization, validateCreateSession
 */
router.post(
  "/",
  roleAuthorization(["super_admin"]),
  validateCreateSession,
  createSessionWithTerms
);

/**
 * @route GET /
 * @description Get the current active session
 * @access Public
 */
router.get("/", getSession);

/**
 * @route GET /all
 * @description Get all sessions
 * @access Public
 */
router.get("/all", getAllSessions);

/**
 * @route GET /all-term
 * @description Get all terms across all sessions
 * @access Public
 */
router.get("/all-term", getAllTerms);

/**
 * @route GET /term
 * @description Get details of a specific term
 * @access Public
 */
router.get("/term/:id", getTermById);

/**
 * @route GET /:id
 * @description Get details of a specific session by its ID
 * @access Public
 */
router.get("/:id", getSessionById);

/**
 * @route PUT /:id
 * @description Update a session along with its terms
 * @access Super Admin only
 * @middleware roleAuthorization, validateUpdateSession
 */
router.put(
  "/:id",
  roleAuthorization(["super_admin"]),
  validateUpdateSession,
  updateSessionWithTerms
);

/**
 * @route DELETE /:id
 * @description Delete a session by its ID
 * @access Super Admin only
 * @middleware roleAuthorization, validateDeleteSession
 */
router.delete(
  "/:id",
  roleAuthorization(["super_admin"]),
  validateDeleteSession,
  deleteSession
);

/**
 * @route DELETE /term/:id
 * @description Delete a term by its ID
 * @access Super Admin only
 * @middleware roleAuthorization, validateDeleteTerm
 */
router.delete(
  "/term/:id",
  roleAuthorization(["super_admin"]),
  validateDeleteTerm,
  deleteTerm
);


export default router;
