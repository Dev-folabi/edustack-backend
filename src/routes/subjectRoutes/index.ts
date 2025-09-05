import { Router } from "express";
import {
  roleAuthorization,
  verifyToken,
} from "../../middlewares/authorization";
import { ADMIN_ROLES } from "../../config/constants";
import {
  assignTeacherToSubject,
  createSubject,
  deleteSubject,
  getSubjectById,
  getSubjects,
  updateSubject,
} from "../../controllers/subjectController";
import {
  validateAssignTeacherToSubject,
  validateCreateSubject,
  validateGetSubjects,
  validateUpdateSubjects,
} from "../../middlewares/Validators";

const router = Router();

router.post(
  "/",
  roleAuthorization([...ADMIN_ROLES]),
  validateCreateSubject,
  createSubject
);

router.get("/", validateGetSubjects, getSubjects);

router.get("/:id", getSubjectById);

router.put(
  "/:id",
  roleAuthorization([...ADMIN_ROLES]),
  validateUpdateSubjects,
  updateSubject
);

router.delete("/:id", roleAuthorization([...ADMIN_ROLES]), deleteSubject);

router.put(
  "/:id/teacher",
  roleAuthorization([...ADMIN_ROLES]),
  validateAssignTeacherToSubject,
  assignTeacherToSubject
);

export default router;
