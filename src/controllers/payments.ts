import { Request, Response } from "express";
import prisma from "../prisma";
import logger from "../utils/logger";
import { handleError } from "../error/errorHandler";
import PaystackService from "../service/paystackService";

export const initializeOnlinePayment = async (req: Request, res: Response) => {
  try {
    const { studentInvoiceId, amount, schoolId, callbackUrl } = req.body;
    const userId = (req as any).user;

    // Fetch student invoice with related student and invoice
    const studentInvoice = await prisma.studentInvoice.findFirst({
      where: {
        id: studentInvoiceId,
        invoice: { schoolId },
      },
      include: {
        invoice: {
          select: {
            id: true,
            allowPartialPayment: true,
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            parent: {
              select: { email: true },
            },
            user: {
              select: { email: true },
            },
          },
        },
      },
    });

    if (!studentInvoice) {
      return handleError(res, "Student invoice not found", 404);
    }

    // Validate payment amount
    const remainingBalance = studentInvoice.amountDue;

    if (amount > remainingBalance) {
      return handleError(
        res,
        `Payment amount exceeds remaining balance of ${remainingBalance}`,
        400
      );
    }

    const wouldBePartialPayment = amount < remainingBalance;
    const allowPartial =
      (studentInvoice as any).invoice?.allowPartialPayment === true;
    if (wouldBePartialPayment && !allowPartial) {
      return handleError(
        res,
        "Partial payments are not allowed for this invoice. Please pay the full remaining balance.",
        400
      );
    }

    // Get Paystack configuration for school
    const paymentGateway = await prisma.paymentGateway.findFirst({
      where: {
        schoolId,
        provider: "PAYSTACK",
        isActive: true,
      },
    });

    if (!paymentGateway) {
      return handleError(res, "Paystack not configured for this school", 400);
    }

    // Generate payment reference
    const paymentCount = await prisma.payment.count({ where: { schoolId } });
    const paymentNumber = `PAY-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(6, "0")}`;
    const reference = `${paymentNumber}-${Date.now()}`;

    // Initialize Paystack service
    const paystackService = new PaystackService({
      secretKey: paymentGateway.secretKey,
      publicKey: paymentGateway.publicKey,
    });

    // Create pending payment record
    const payment = await prisma.payment.create({
      data: {
        paymentNumber,
        studentInvoiceId,
        amount,
        paymentMethod: "CARD",
        transactionRef: reference,
        status: "PENDING",
        schoolId,
        createdBy: userId,
      },
    });

    // Initialize payment with Paystack
    const studentEmail =
      (studentInvoice as any).student?.email ||
      (studentInvoice as any).student?.parent?.email ||
      (studentInvoice as any).student?.user?.email;
    const paystackResponse = await paystackService.initializePayment({
      email: studentEmail,
      amount: amount * 100, // Convert to kobo
      reference,
      callback_url: callbackUrl || paymentGateway.callbackUrl,
      metadata: {
        paymentId: payment.id,
        invoiceId: (studentInvoice as any).invoice?.id,
        studentId: (studentInvoice as any).student?.id,
        schoolId,
        studentName: (studentInvoice as any).student?.name,
      },
    });

    // Update payment with gateway response
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayResponse: paystackResponse.data,
      },
    });

    logger.info(
      `Online payment initialized: ${payment.id} for student invoice: ${studentInvoiceId}`
    );

    res.status(201).json({
      success: true,
      message: "Payment initialized successfully",
      data: {
        payment,
        paymentUrl: paystackResponse.data.authorization_url,
        reference,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error initializing online payment:");
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Enhanced webhook handler
export const handlePaymentWebhook = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const signature = req.headers["x-paystack-signature"] as string;
    const payload = JSON.stringify(req.body);

    if (provider.toLowerCase() !== "paystack") {
      return handleError(res, "Unsupported payment provider", 400);
    }

    // Get any active Paystack configuration to validate webhook
    const paymentGateway = await prisma.paymentGateway.findFirst({
      where: {
        provider: "PAYSTACK",
        isActive: true,
      },
    });

    if (!paymentGateway) {
      return handleError(res, "No active Paystack configuration found", 400);
    }

    // Validate webhook signature
    const paystackService = new PaystackService({
      secretKey: paymentGateway.secretKey,
      publicKey: paymentGateway.publicKey,
    });

    if (!paystackService.validateWebhook(payload, signature)) {
      return handleError(res, "Invalid webhook signature", 401);
    }

    const event = req.body;
    const { event: eventType, data } = event;

    logger.info(`Paystack webhook received: ${eventType}`);

    switch (eventType) {
      case "charge.success":
        await handleSuccessfulPayment(data);
        break;
      case "charge.failed":
        await handleFailedPayment(data);
        break;
      default:
        logger.info(`Unhandled webhook event: ${eventType}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error({ error }, "Webhook processing error:");
    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

// Helper function to handle successful payments
const handleSuccessfulPayment = async (data: any) => {
  const { reference, amount, metadata } = data;

  try {
    // Find the payment record
    const payment = await prisma.payment.findFirst({
      where: {
        transactionRef: reference,
        status: "PENDING",
      },
      include: {
        studentInvoice: true,
      },
    });

    if (!payment) {
      logger.error(`Payment not found for reference: ${reference}`);
      return;
    }

    // Verify amount matches
    const expectedAmount = payment.amount * 100; // Convert to kobo
    if (amount !== expectedAmount) {
      logger.error(
        `Amount mismatch for ${reference}: expected ${expectedAmount}, got ${amount}`
      );
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          paidAt: new Date(),
          gatewayResponse: data,
        },
      });

      // Update student invoice amounts
      const si = payment.studentInvoice;
      const newAmountPaid = si.amountPaid + payment.amount;
      const newAmountDue = si.totalAmount - newAmountPaid;

      let newStatus;
      if (newAmountDue <= 0) {
        newStatus = "PAID";
      } else if (newAmountPaid > 0) {
        newStatus = "PARTIALLY_PAID";
      } else {
        newStatus = si.status;
      }

      await tx.studentInvoice.update({
        where: { id: si.id },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newStatus,
        },
      });
    });

    logger.info(`Payment completed successfully: ${payment.id}`);
  } catch (error) {
    logger.error(
      { error },
      `Error processing successful payment for ${reference}`
    );
  }
};

// Helper function to handle failed payments
const handleFailedPayment = async (data: any) => {
  const { reference } = data;

  try {
    const payment = await prisma.payment.findFirst({
      where: {
        transactionRef: reference,
        status: "PENDING",
      },
    });

    if (!payment) {
      logger.error(`Payment not found for reference: ${reference}`);
      return;
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        gatewayResponse: data,
      },
    });

    logger.info(`Payment failed: ${payment.id}`);
  } catch (error) {
    logger.error({ error }, `Error processing failed payment for ${reference}`);
  }
};

// Add verification endpoint
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const { schoolId } = req.query;

    // Get payment record
    const payment = await prisma.payment.findFirst({
      where: {
        transactionRef: reference,
        schoolId: schoolId as string,
      },
      include: {
        studentInvoice: {
          include: {
            invoice: true,
            student: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!payment) {
      return handleError(res, "Payment not found", 404);
    }

    // Get Paystack configuration
    const paymentGateway = await prisma.paymentGateway.findFirst({
      where: {
        schoolId: schoolId as string,
        provider: "PAYSTACK",
        isActive: true,
      },
    });

    if (!paymentGateway) {
      return handleError(res, "Paystack not configured", 400);
    }

    // Verify with Paystack
    const paystackService = new PaystackService({
      secretKey: paymentGateway.secretKey,
      publicKey: paymentGateway.publicKey,
    });

    const verification = await paystackService.verifyPayment(reference);

    if (
      verification.data.status === "success" &&
      payment.status === "PENDING"
    ) {
      // Process the successful payment
      await handleSuccessfulPayment(verification.data);
    }

    res.json({
      success: true,
      message: "Payment verification completed",
      data: {
        payment,
        verification: verification.data,
      },
    });
  } catch (error) {
    logger.error({ error }, "Payment verification error");
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};
