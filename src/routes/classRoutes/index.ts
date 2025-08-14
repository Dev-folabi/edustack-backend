import express from "express";
import {
  getAllClasses,
  getClassById,
  updateClass,
  deleteClass,
  createClass,
} from "../../controllers/classController";
import {
  validateCreateClass,
  validateUpdateClass,
} from "../../middlewares/Validators";
import { roleAuthorization } from "../../middlewares/authorization";
import { ADMIN_ROLES } from "../../config/constants";

const router = express.Router();

// Class Routes
router.post("/", roleAuthorization([...ADMIN_ROLES]), validateCreateClass, createClass);
router.get("/", getAllClasses);
router.get("/:id", getClassById);
router.put("/:id", roleAuthorization([...ADMIN_ROLES]), validateUpdateClass, updateClass);
router.delete("/:id", roleAuthorization([...ADMIN_ROLES]), deleteClass);

export default router;
