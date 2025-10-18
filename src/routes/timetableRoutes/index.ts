import { Router } from "express";
import {
  createTimetable,
  deleteTimetable,
  getClassTimetable,
  getSchoolTimetables,
  createEntry,
  updateEntry,
  deleteEntry,
  updateTimetable,
} from "../../controllers/timetableController";
import {
  validateCreateTimetable,
  validateCreateEntry,
  validateUpdateEntry,
  validateDeleteEntry,
} from "../../middlewares/Validators";
import { roleAuthorization } from "../../middlewares/authorization";
import { TEACHER_ROLES } from "../../config/constants";

const router = Router();

router.post(
  "/",
  roleAuthorization([...TEACHER_ROLES]),
  validateCreateTimetable,
  createTimetable
);
router.put(
  "/:timetableId",
  roleAuthorization([...TEACHER_ROLES]),
  updateTimetable
);
router.delete(
  "/:timetableId",
  roleAuthorization([...TEACHER_ROLES]),
  deleteTimetable
);
router.get("/class/:sectionId", getClassTimetable);
router.get("/school/:schoolId", getSchoolTimetables);
router.post(
  "/entries",
  roleAuthorization([...TEACHER_ROLES]),
  validateCreateEntry,
  createEntry
);
router.put(
  "/entries/:entryId",
  roleAuthorization([...TEACHER_ROLES]),
  validateUpdateEntry,
  updateEntry
);
router.delete(
  "/entries/:entryId",
  roleAuthorization([...TEACHER_ROLES]),
  validateDeleteEntry,
  deleteEntry
);

export default router;
