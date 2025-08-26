import express from "express";
import { verifyToken, roleAuthorization } from "../../middlewares/authorization";
import {
    createQuestionBank,
    getQuestionBanks,
    getQuestionBankById,
    updateQuestionBank,
    deleteQuestionBank,
    addQuestionToBank,
    updateQuestion,
    deleteQuestion
} from "../../controllers/questionBankController";
import { TEACHER_ROLES } from "../../config/constants";

const router = express.Router();

// Protect all routes in this file
router.use(verifyToken);
router.use(roleAuthorization([...TEACHER_ROLES]));

// --- Question Bank Routes ---
router.post("/", createQuestionBank);
router.get("/", getQuestionBanks);
router.get("/:id", getQuestionBankById);
router.put("/:id", updateQuestionBank);
router.delete("/:id", deleteQuestionBank);

// --- Question Routes (nested under a bank) ---
router.post("/:bankId/questions", addQuestionToBank);
router.put("/:bankId/questions/:questionId", updateQuestion);
router.delete("/:bankId/questions/:questionId", deleteQuestion);

export default router;
