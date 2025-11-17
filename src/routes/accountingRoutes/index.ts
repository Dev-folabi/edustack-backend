import { Router } from "express";
import {
  verifyToken,
  roleAuthorization,
} from "../../middlewares/authorization";
import {
  createFeeCategoryValidator,
  updateFeeCategoryValidator,
  updateInvoiceValidator,
  createAndAssignInvoiceValidator,
  createPaymentValidator,
  createExpenseValidator,
  updateExpenseValidator,
  createPaymentGatewayValidator,
  updatePaymentGatewayValidator,
  financialReportValidator,
} from "../../middlewares/Validators";
import {
  createFeeCategory,
  getFeeCategories,
  getFeeCategoryById,
  updateFeeCategory,
  deleteFeeCategory,
  createAndAssignInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  createPayment,
  getPayments,
  getPaymentById,
  updatePaymentStatus,
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  createPaymentGateway,
  getPaymentGateways,
  updatePaymentGateway,
  getFinancialOverview,
  getStudentFinancialReport,
  getStudentInvoicesByStudentId,
  getPaymentReport,
  handlePaymentWebhook,
  cancelStudentInvoice,
} from "../../controllers/accountingController";
import {
  FINANCE_ROLES,
  ADMIN_ROLES,
  STUDENT_ROLES,
} from "../../config/constants";

const router = Router();

// Fee Categories Routes
router.post(
  "/fee-categories",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  createFeeCategoryValidator,
  createFeeCategory
);

router.get(
  "/fee-categories/:schoolId",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  getFeeCategories
);

router.get(
  "/fee-categories/:schoolId/:id",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),

  getFeeCategoryById
);

router.put(
  "/fee-categories/:id",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  updateFeeCategoryValidator,
  updateFeeCategory
);

router.delete(
  "/fee-categories/:id",
  verifyToken,
  roleAuthorization([...ADMIN_ROLES]),

  deleteFeeCategory
);

// Invoice Routes
router.post(
  "/invoices/create-and-assign",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  createAndAssignInvoiceValidator,
  createAndAssignInvoice
);

router.get(
  "/invoices",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  getInvoices
);

router.get(
  "/invoices/:id",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),

  getInvoiceById
);

router.put(
  "/invoices/:id",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  updateInvoiceValidator,
  updateInvoice
);

router.delete(
  "/invoices/:id",
  verifyToken,
  roleAuthorization([...ADMIN_ROLES]),

  deleteInvoice
);

router.patch(
  "/student-invoices/:id/cancel",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),

  cancelStudentInvoice
);

// Payment Routes
router.post(
  "/payments",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  createPaymentValidator,
  createPayment
);

router.get(
  "/payments/school/:schoolId",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES, ...STUDENT_ROLES]),
  getPayments
);

router.get(
  "/payments/:id",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES, ...STUDENT_ROLES]),
  getPaymentById
);

router.put(
  "/payments/:id/status",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),

  updatePaymentStatus
);

// Expense Routes
router.post(
  "/expenses",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  createExpenseValidator,
  createExpense
);

router.get(
  "/expenses",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  getExpenses
);

router.get(
  "/expenses/:id",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),

  getExpenseById
);

router.put(
  "/expenses/:id",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  updateExpenseValidator,
  updateExpense
);

router.delete(
  "/expenses/:id",
  verifyToken,
  roleAuthorization([...ADMIN_ROLES]),

  deleteExpense
);

// Payment Gateway Routes
router.post(
  "/payment-gateways/:schoolId",

  verifyToken,
  roleAuthorization([...ADMIN_ROLES]),
  createPaymentGatewayValidator,
  createPaymentGateway
);

router.get(
  "/payment-gateways/:schoolId",

  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  getPaymentGateways
);

router.put(
  "/payment-gateways/:id",
  verifyToken,
  roleAuthorization([...ADMIN_ROLES]),
  updatePaymentGatewayValidator,
  updatePaymentGateway
);

// Report Routes
router.get(
  "/reports/financial-overview/:schoolId",

  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  financialReportValidator,
  getFinancialOverview
);

router.get(
  "/reports/student/:studentId/:schoolId",

  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),

  getStudentFinancialReport
);

router.get(
  "/student-invoices/student/:studentId/:schoolId",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES, ...STUDENT_ROLES]),

  getStudentInvoicesByStudentId
);

router.get(
  "/reports/payments/:schoolId",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  financialReportValidator,
  getPaymentReport
);

// Webhook Routes (no authentication for external services)
router.post("/webhooks/:provider", handlePaymentWebhook);

export default router;
