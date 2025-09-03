import { Router } from "express";
import {
  verifyToken,
  roleAuthorization,
} from "../../middlewares/authorization";
import { FINANCE_ROLES, ADMIN_ROLES } from "../../config/constants";
import {
  onlinePaymentValidator,
  verifyPaymentValidator,
} from "../../middlewares/Validators";
import {
  initializeOnlinePayment,
  verifyPayment,
} from "../../controllers/payments";

const router = Router();

// Online Payment Routes
router.post(
  "/payments/initialize",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  onlinePaymentValidator,
  initializeOnlinePayment
);

router.get(
  "/payments/verify/:reference",
  verifyToken,
  roleAuthorization([...FINANCE_ROLES]),
  verifyPaymentValidator,
  verifyPayment
);
