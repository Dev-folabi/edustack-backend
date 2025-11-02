import { Request, Response } from "express";
import prisma from "../prisma";
import logger from "../utils/logger";
import { paginateResults } from "../function/pagination";
import {
  CreateFeeCategoryRequest,
  UpdateFeeCategoryRequest,
  UpdateInvoiceRequest,
  CreateAndAssignInvoiceRequest,
  CreatePaymentRequest,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  CreatePaymentGatewayRequest,
  UpdatePaymentGatewayRequest,
  FinancialReportQuery,
} from "../types/requests/accounting";
import { handleError } from "../error/errorHandler";

// Fee Categories
export const createFeeCategory = async (
  req: Request<{}, {}, CreateFeeCategoryRequest>,
  res: Response
) => {
  try {
    const { name, description, schoolId } = req.body;

    const existingCategory = await prisma.feeCategory.findFirst({
      where: {
        name,
        schoolId,
      },
    });

    if (existingCategory) {
      res.status(409).json({
        success: false,
        message: "Fee category with this name already exists",
      });
      return;
    }

    const feeCategory = await prisma.feeCategory.create({
      data: {
        name,
        description,
        schoolId,
      },
    });

    logger.info(`Fee category created: ${feeCategory.name}`);

    res.status(201).json({
      success: true,
      message: "Fee category created successfully",
      data: feeCategory,
    });
  } catch (error) {
    logger.error("Error creating fee category:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getFeeCategories = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 12 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    if (!schoolId) {
      handleError(res, "school id is required", 400);
    }
    const [feeCategories, total] = await Promise.all([
      prisma.feeCategory.findMany({
        where: { schoolId: String(schoolId) },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.feeCategory.count({ where: { schoolId: String(schoolId) } }),
    ]);

    res.json({
      success: true,
      message: "Fee categories retrieved successfully",
      data: paginateResults(feeCategories, Number(page), Number(limit), total),
    });
  } catch (error) {
    logger.error("Error fetching fee categories:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getFeeCategoryById = async (req: Request, res: Response) => {
  try {
    const { id, schoolId } = req.params;
    const feeCategory = await prisma.feeCategory.findFirst({
      where: {
        id,
        schoolId,
      },
    });

    if (!feeCategory) {
      handleError(res, "Fee category not found", 404);
    }

    res.json({
      success: true,
      message: "Fee category retrieved successfully",
      data: feeCategory,
    });
  } catch (error) {
    logger.error("Error fetching fee category:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateFeeCategory = async (req: Request, res: Response) => {
  try {
    const { id, schoolId } = req.params;
    const updateData: UpdateFeeCategoryRequest = req.body;

    // Check if fee category exists
    const existingCategory = await prisma.feeCategory.findFirst({
      where: {
        id,
      },
    });

    if (!existingCategory) {
      handleError(res, "Fee category not found", 404);
      return;
    }

    if (updateData.name && updateData.name !== existingCategory.name) {
      const nameConflict = await prisma.feeCategory.findFirst({
        where: {
          name: updateData.name,
          schoolId,
          id: { not: id },
        },
      });

      if (nameConflict) {
        handleError(res, "Fee category with this name already exists", 409);
        return;
      }
    }

    const updatedCategory = await prisma.feeCategory.update({
      where: { id },
      data: updateData,
    });

    logger.info(`Fee category updated: ${id}`);

    res.json({
      success: true,
      message: "Fee category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    logger.error("Error updating fee category:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteFeeCategory = async (req: Request, res: Response) => {
  try {
    const { id, schoolId } = req.params;

    // Check if fee category exists
    const feeCategory = await prisma.feeCategory.findFirst({
      where: {
        id,
        schoolId,
      },
    });

    if (!feeCategory) {
      handleError(res, "Fee category not found", 404);
      return;
    }

    // Check if fee category is being used in any invoice items
    const usageCount = await prisma.invoiceItem.count({
      where: { feeCategoryId: id },
    });

    if (usageCount > 0) {
      handleError(
        res,
        "Cannot delete fee category as it is being used in invoices",
        400
      );
      return;
    }

    await prisma.feeCategory.delete({
      where: { id },
    });

    logger.info(`Fee category deleted: ${id}`);

    res.json({
      success: true,
      message: "Fee category deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting fee category:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Invoices
export const createAndAssignInvoice = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      dueDate,
      termId,
      sessionId,
      items,
      assignmentType,
      studentIds,
      classId,
      sectionId,
      schoolId,
      allowPartialPayment = false,
    }: CreateAndAssignInvoiceRequest = req.body;

    const { userId } = (req as any).user;

    // Validate fee categories exist
    const feeCategoryIds = items.map((item) => item.feeCategoryId);
    const feeCategories = await prisma.feeCategory.findMany({
      where: {
        id: { in: feeCategoryIds },
        schoolId,
      },
    });

    if (feeCategories.length !== feeCategoryIds.length) {
      handleError(res, "One or more fee categories not found", 400);
      return;
    }

    // Get target student IDs based on assignment type
    let targetStudentIds: string[] = [];

    switch (assignmentType) {
      case "SINGLE_STUDENT":
      case "MULTIPLE_STUDENTS":
        targetStudentIds = studentIds || [];
        break;

      case "CLASS":
        if (!classId) {
          handleError(res, "Class ID is required for class assignment", 400);
          return;
        }
        const classStudents = await prisma.studentEnrollment.findMany({
          where: {
            classId,
            status: "enrolled",
          },
          select: { studentId: true },
        });
        targetStudentIds = classStudents.map((s) => s.studentId);
        break;

      case "SECTION":
        if (!sectionId) {
          handleError(
            res,
            "Section ID is required for section assignment",
            400
          );
          return;
        }
        const sectionStudents = await prisma.studentEnrollment.findMany({
          where: {
            sectionId,
            status: "enrolled",
          },
          select: { studentId: true },
        });
        targetStudentIds = sectionStudents.map((s) => s.studentId);
        break;
    }

    if (targetStudentIds.length === 0) {
      handleError(res, "No students found for assignment", 400);
      return;
    }

    // Verify students exist and belong to the school
    const validStudents = await prisma.student.findMany({
      where: {
        id: { in: targetStudentIds },
        isActive: true,
      },
      include: {
        student_enrolled: {
          where: {
            status: "enrolled",
            class: {
              schoolId,
            },
          },
        },
      },
    });

    const validStudentIds = validStudents
      .filter((s) => s.student_enrolled.length > 0)
      .map((s) => s.id);

    if (validStudentIds.length === 0) {
      handleError(res, "No valid students found for assignment", 400);
      return;
    }

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    // Generate invoice number
    const invoiceCount = await prisma.invoice.count({ where: { schoolId } });
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(
      invoiceCount + 1
    ).padStart(4, "0")}`;

    const result = await prisma.$transaction(async (tx) => {
      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          title,
          description,
          allowPartialPayment,
          dueDate: dueDate ? new Date(dueDate) : null,
          schoolId,
          termId,
          sessionId,
          createdBy: userId,
        },
      });

      // Create invoice items
      await Promise.all(
        items.map((item) =>
          tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              feeCategoryId: item.feeCategoryId,
              description: item.description,
              amount: item.amount,
            },
          })
        )
      );

      // Create student assignments
      const assignments = await tx.studentInvoice.createMany({
        data: validStudentIds.map((studentId) => ({
          invoiceId: invoice.id,
          studentId,
          assignedBy: userId,
          totalAmount,
          amountDue: totalAmount,
        })),
      });

      return { invoice, assignments };
    });

    logger.info(
      `Invoice created and assigned: ${result.invoice.id} to ${result.assignments.count} students by user: ${userId}`
    );

    res.status(201).json({
      success: true,
      message: `Invoice created and assigned to ${result.assignments.count} students successfully`,
      data: {
        invoice: result.invoice,
        assignedCount: result.assignments.count,
      },
    });
  } catch (error) {
    logger.error("Error creating and assigning invoice:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 12, status, termId, sessionId } = req.query;
    const { schoolId } = req.params;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { schoolId };
    if (termId) where.termId = termId;
    if (sessionId) where.sessionId = sessionId;
    if (status) {
      where.studentInvoices = {
        some: {
          status: status as any,
        },
      };
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          invoiceItems: {
            include: {
              feeCategory: true,
            },
          },
          term: true,
          session: true,
          studentInvoices: true,
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.count({ where }),
    ]);

    const processedInvoices = invoices.map((invoice) => {
      const totalAmount = invoice.studentInvoices.reduce(
        (sum, si) => sum + si.totalAmount,
        0
      );
      const amountPaid = invoice.studentInvoices.reduce(
        (sum, si) => sum + si.amountPaid,
        0
      );
      const amountDue = totalAmount - amountPaid;

      const statuses = new Set(invoice.studentInvoices.map((si) => si.status));
      let overallStatus = "UNPAID";
      if (statuses.size === 0) {
        overallStatus = "UNPAID"; // No students, so unpaid.
      } else if (statuses.size === 1 && statuses.has("PAID")) {
        overallStatus = "PAID";
      } else if (statuses.has("OVERDUE")) {
        overallStatus = "OVERDUE";
      } else if (statuses.has("PAID") || statuses.has("PARTIALLY_PAID")) {
        overallStatus = "PARTIALLY_PAID";
      } else if (statuses.size === 1 && statuses.has("CANCELLED")) {
        overallStatus = "CANCELLED";
      }

      const { studentInvoices, ...rest } = invoice;

      return {
        ...rest,
        totalAmount,
        amountPaid,
        amountDue,
        status: overallStatus,
        studentInvoicesCount: studentInvoices.length,
      };
    });

    res.json({
      success: true,
      message: "Invoices retrieved successfully",
      data: paginateResults(
        processedInvoices,
        Number(page),
        Number(limit),
        total
      ),
    });
  } catch (error) {
    logger.error("Error fetching invoices:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
      },
      include: {
        invoiceItems: {
          include: {
            feeCategory: true,
          },
        },
        term: true,
        session: true,
        studentInvoices: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                admission_number: true,
              },
            },
            payments: true,
          },
        },
      },
    });

    if (!invoice) {
      handleError(res, "Invoice not found", 404);
      return;
    }

    const totalAmount = invoice.studentInvoices.reduce(
      (sum, si) => sum + si.totalAmount,
      0
    );
    const amountPaid = invoice.studentInvoices.reduce(
      (sum, si) => sum + si.amountPaid,
      0
    );
    const amountDue = totalAmount - amountPaid;

    const statuses = new Set(invoice.studentInvoices.map((si) => si.status));
    let overallStatus = "UNPAID";
    if (statuses.size === 0) {
      overallStatus = "UNPAID";
    } else if (statuses.size === 1 && statuses.has("PAID")) {
      overallStatus = "PAID";
    } else if (statuses.has("OVERDUE")) {
      overallStatus = "OVERDUE";
    } else if (statuses.has("PAID") || statuses.has("PARTIALLY_PAID")) {
      overallStatus = "PARTIALLY_PAID";
    } else if (statuses.size === 1 && statuses.has("CANCELLED")) {
      overallStatus = "CANCELLED";
    }

    const { studentInvoices, ...rest } = invoice;

    res.json({
      success: true,
      message: "Invoice retrieved successfully",
      data: {
        ...rest,
        totalAmount,
        amountPaid,
        amountDue,
        status: overallStatus,
        studentInvoices,
      },
    });
  } catch (error) {
    logger.error("Error fetching invoice:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = (req as any).user;
    const updateData: UpdateInvoiceRequest = req.body;

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id,
      },
    });

    if (!existingInvoice) {
      handleError(res, "Invoice not found", 404);
      return;
    }

    const processedData: any = { ...updateData };
    if (updateData.dueDate) {
      processedData.dueDate = new Date(updateData.dueDate);
    }
    delete processedData.status;

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: processedData,
      include: {
        invoiceItems: {
          include: {
            feeCategory: true,
          },
        },
      },
    });

    logger.info(`Invoice updated: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: "Invoice updated successfully",
      data: updatedInvoice,
    });
  } catch (error) {
    logger.error("Error updating invoice:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = (req as any).user;

    // Check if invoice exists
    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
      },
    });

    if (!invoice) {
      handleError(res, "Invoice not found", 404);
      return;
    }

    // Prevent deleting invoices with payments
    const studentInvoices = await prisma.studentInvoice.findMany({
      where: { invoiceId: id },
      include: {
        payments: true,
      },
    });

    for (const si of studentInvoices) {
      if (si.payments.length > 0) {
        handleError(
          res,
          `Cannot delete invoice because student ${si.studentId} has payments associated with it.`,
          400
        );
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      // Delete payments (although there should be none)
      await tx.payment.deleteMany({
        where: {
          studentInvoice: {
            invoiceId: id,
          },
        },
      });
      // Delete student assignments
      await tx.studentInvoice.deleteMany({
        where: { invoiceId: id },
      });

      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });
      // Delete invoice
      await tx.invoice.delete({
        where: { id },
      });
    });

    logger.info(`Invoice deleted: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting invoice:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Payments
export const createPayment = async (req: Request, res: Response) => {
  try {
    const {
      studentInvoiceId,
      amount,
      paymentMethod,
      transactionRef,
      schoolId,
    }: CreatePaymentRequest = req.body;
    const { userId } = (req as any).user;

    // Verify student invoice exists and belongs to school
    const studentInvoice = await prisma.studentInvoice.findFirst({
      where: {
        id: studentInvoiceId,
        invoice: {
          schoolId,
        },
      },
      include: {
        invoice: true,
      },
    });

    if (!studentInvoice) {
      handleError(res, "Student invoice not found", 404);
      return;
    }

    // Check if payment amount doesn't exceed remaining balance
    if (amount > studentInvoice.amountDue) {
      handleError(
        res,
        `Payment amount exceeds remaining balance of ${studentInvoice.amountDue}`,
        400
      );
      return;
    }

    // Validate partial payment is allowed
    const wouldBePartialPayment = amount < studentInvoice.amountDue;
    if (wouldBePartialPayment && !studentInvoice.invoice.allowPartialPayment) {
      handleError(
        res,
        "Partial payments are not allowed for this invoice. Please pay the full remaining balance.",
        400
      );
      return;
    }


    // Generate payment number
    const paymentCount = await prisma.payment.count({ where: { schoolId } });
    const paymentNumber = `PAY-${new Date().getFullYear()}-${String(
      paymentCount + 1
    ).padStart(6, "0")}`;

    const result = await prisma.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          studentInvoiceId,
          amount,
          paymentMethod,
          transactionRef,
          status: paymentMethod === "CASH" ? "COMPLETED" : "PENDING",
          paidAt: paymentMethod === "CASH" ? new Date() : null,
          schoolId,
          createdBy: userId,
        },
      });

      // Update student invoice amounts if payment is completed
      if (payment.status === "COMPLETED") {
        const newAmountPaid = studentInvoice.amountPaid + amount;
        const newAmountDue = studentInvoice.totalAmount - newAmountPaid;

        let newStatus;
        if (newAmountDue <= 0) {
          newStatus = "PAID";
        } else {
          newStatus = "PARTIALLY_PAID";
        }

        await tx.studentInvoice.update({
          where: { id: studentInvoiceId },
          data: {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newStatus,
          },
        });
      }

      return payment;
    });

    logger.info(
      `Payment created: ${result.id} for student invoice: ${studentInvoiceId} by user: ${userId}`
    );

    res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error creating payment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getPayments = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      schoolId,
      status,
      studentInvoiceId,
      paymentMethod,
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { schoolId };
    if (status) where.status = status;
    if (studentInvoiceId) where.studentInvoiceId = studentInvoiceId;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          studentInvoice: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  admission_number: true,
                },
              },
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  title: true,
                },
              },
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      success: true,
      message: "Payments retrieved successfully",
      data: paginateResults(payments, Number(page), Number(limit), total),
    });
  } catch (error) {
    logger.error("Error fetching payments:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findFirst({
      where: {
        id,
      },
      include: {
        studentInvoice: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                admission_number: true,
                email: true,
                phone: true,
              },
            },
            invoice: {
              include: {
                invoiceItems: {
                  include: {
                    feeCategory: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      handleError(res, "Payment not found", 404);
      return;
    }

    res.json({
      success: true,
      message: "Payment retrieved successfully",
      data: payment,
    });
  } catch (error) {
    logger.error("Error fetching payment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { schoolId, status } = req.body;
    const { userId } = (req as any).user;

    if (!["PENDING", "COMPLETED", "FAILED", "REFUNDED"].includes(status)) {
      handleError(res, "Invalid payment status", 400);
      return;
    }

    const payment = await prisma.payment.findFirst({
      where: {
        id,
        schoolId,
      },
      include: {
        studentInvoice: true,
      },
    });

    if (!payment) {
      handleError(res, "Payment not found", 404);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update payment status
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status,
          paidAt: status === "COMPLETED" ? new Date() : payment.paidAt,
        },
      });

      // Update student invoice amounts based on payment status change
      if (payment.status !== status) {
        let amountChange = 0;

        if (payment.status === "COMPLETED" && status !== "COMPLETED") {
          amountChange = -payment.amount;
        } else if (payment.status !== "COMPLETED" && status === "COMPLETED") {
          amountChange = payment.amount;
        }

        if (amountChange !== 0) {
          const newAmountPaid =
            payment.studentInvoice.amountPaid + amountChange;
          const newAmountDue =
            payment.studentInvoice.totalAmount - newAmountPaid;

          let newStatus;
          if (newAmountDue <= 0) {
            newStatus = "PAID";
          } else if (newAmountPaid > 0) {
            newStatus = "PARTIALLY_PAID";
          } else {
            newStatus = "UNPAID";
          }

          await tx.studentInvoice.update({
            where: { id: payment.studentInvoiceId },
            data: {
              amountPaid: newAmountPaid,
              amountDue: newAmountDue,
              status: newStatus,
            },
          });
        }
      }

      return updatedPayment;
    });

    logger.info(
      `Payment status updated: ${id} to ${status} by user: ${userId}`
    );

    res.json({
      success: true,
      message: "Payment status updated successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error updating payment status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const cancelStudentInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = (req as any).user;

    const studentInvoice = await prisma.studentInvoice.findFirst({
      where: {
        id,
      },
      include: {
        payments: {
          where: {
            status: "COMPLETED",
          },
        },
      },
    });

    if (!studentInvoice) {
      handleError(res, "Student invoice not found", 404);
      return;
    }

    if (studentInvoice.payments.length > 0) {
      handleError(
        res,
        "Cannot cancel an invoice that has completed payments.",
        400
      );
      return;
    }

    const updatedStudentInvoice = await prisma.studentInvoice.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
    });

    logger.info(
      `Student invoice cancelled: ${id} by user: ${userId}`
    );

    res.json({
      success: true,
      message: "Student invoice cancelled successfully",
      data: updatedStudentInvoice,
    });
  } catch (error) {
    logger.error("Error cancelling student invoice:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

// Expenses
export const createExpense = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      amount,
      category,
      receiptUrl,
      expenseDate,
      schoolId,
    }: CreateExpenseRequest = req.body;
    const { userId } = (req as any).user;

    const expense = await prisma.expense.create({
      data: {
        title,
        description,
        amount,
        category,
        receiptUrl,
        expenseDate: new Date(expenseDate),
        schoolId,
        createdBy: userId,
      },
    });

    logger.info(`Expense created: ${expense.id} by user: ${userId}`);

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: expense,
    });
  } catch (error) {
    logger.error("Error creating expense:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 10, category, startDate, endDate } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { schoolId };
    if (category) where.category = category;
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate as string);
      if (endDate) where.expenseDate.lte = new Date(endDate as string);
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take,
        orderBy: { expenseDate: "desc" },
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({
      success: true,
      message: "Expenses retrieved successfully",
      data: paginateResults(expenses, Number(page), Number(limit), total),
    });
  } catch (error) {
    logger.error("Error fetching expenses:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getExpenseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findFirst({
      where: {
        id,
      },
    });

    if (!expense) {
      handleError(res, "Expense not found", 404);
      return;
    }

    res.json({
      success: true,
      message: "Expense retrieved successfully",
      data: expense,
    });
  } catch (error) {
    logger.error("Error fetching expense:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = (req as any).user;
    const updateData: UpdateExpenseRequest = req.body;

    const expense = await prisma.expense.findFirst({
      where: {
        id,
      },
    });

    if (!expense) {
      handleError(res, "Expense not found", 404);
      return;
    }

    const processedData: any = { ...updateData };
    if (updateData.expenseDate) {
      processedData.expenseDate = new Date(updateData.expenseDate);
    }

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: processedData,
    });

    logger.info(`Expense updated: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: "Expense updated successfully",
      data: updatedExpense,
    });
  } catch (error) {
    logger.error("Error updating expense:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = (req as any).user;

    const expense = await prisma.expense.findFirst({
      where: {
        id,
      },
    });

    if (!expense) {
      handleError(res, "Expense not found", 404);
      return;
    }

    await prisma.expense.delete({
      where: { id },
    });

    logger.info(`Expense deleted: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting expense:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Payment Gateways
export const createPaymentGateway = async (req: Request, res: Response) => {
  try {
    const { schoolId,  provider, publicKey,
        secretKey,
        webhookUrl,
        callbackUrl, merchantId, isActive }: CreatePaymentGatewayRequest =
      req.body;
    const { userId } = (req as any).user;

    // Check if gateway with same provider already exists
    const existingGateway = await prisma.paymentGateway.findFirst({
      where: {
        provider,
        schoolId,
      },
    });

    if (existingGateway) {
      handleError(
        res,
        "Payment gateway with this provider already exists",
        409
      );
      return;
    }

    const gateway = await prisma.paymentGateway.create({
      data: {
        provider,
        publicKey,
        secretKey,
        webhookUrl,
        callbackUrl,
        merchantId,
        isActive,
        schoolId,
      },
    });

    logger.info(`Payment gateway created: ${gateway.id} by user: ${userId}`);

    res.status(201).json({
      success: true,
      message: "Payment gateway created successfully",
      data: gateway,
    });
  } catch (error) {
    logger.error("Error creating payment gateway:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getPaymentGateways = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;

    const gateways = await prisma.paymentGateway.findMany({
      where: { schoolId },
      select: {
        id: true,
        provider: true,
        isActive: true,
        merchantId: true,
        webhookUrl: true,
        callbackUrl: true,
        publicKey: true,
        secretKey: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      message: "Payment gateways retrieved successfully",
      data: gateways,
    });
  } catch (error) {
    logger.error("Error fetching payment gateways:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updatePaymentGateway = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = (req as any).user;
    const updateData: UpdatePaymentGatewayRequest = req.body;

    const gateway = await prisma.paymentGateway.findFirst({
      where: {
        id,
      },
    });

    if (!gateway) {
      handleError(res, "Payment gateway not found", 404);
      return;
    }

    const updatedGateway = await prisma.paymentGateway.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        provider: true,
         merchantId: true,
        webhookUrl: true,
        callbackUrl: true,
        publicKey: true,
        secretKey: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info(`Payment gateway updated: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: "Payment gateway updated successfully",
      data: updatedGateway,
    });
  } catch (error) {
    logger.error("Error updating payment gateway:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Financial Reports
export const getFinancialOverview = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { startDate, endDate, termId, sessionId }: FinancialReportQuery =
      req.query;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const invoiceWhere: any = { schoolId };
    if (termId) invoiceWhere.termId = termId;
    if (sessionId) invoiceWhere.sessionId = sessionId;
    if (Object.keys(dateFilter).length > 0) {
      invoiceWhere.createdAt = dateFilter;
    }

    const expenseWhere: any = { schoolId };
    if (Object.keys(dateFilter).length > 0) {
      expenseWhere.expenseDate = dateFilter;
    }

    const [invoiceStats, paymentStats, expenseStats, recentTransactions] =
      await Promise.all([
        // Invoice statistics
        prisma.invoice.aggregate({
          where: invoiceWhere,
          _sum: {
            totalAmount: true,
            amountPaid: true,
            amountDue: true,
          },
          _count: true,
        }),

        // Payment statistics
        prisma.payment.aggregate({
          where: {
            schoolId,
            status: "COMPLETED",
            ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
          },
          _sum: {
            amount: true,
          },
          _count: true,
        }),

        // Expense statistics
        prisma.expense.aggregate({
          where: expenseWhere,
          _sum: {
            amount: true,
          },
          _count: true,
        }),

        // Recent transactions (payments)
        prisma.payment.findMany({
          where: {
            schoolId,
            status: "COMPLETED",
          },
          include: {
            student: {
              select: {
                name: true,
                admission_number: true,
              },
            },
            invoice: {
              select: {
                invoiceNumber: true,
                title: true,
              },
            },
          },
          orderBy: { paidAt: "desc" },
          take: 10,
        }),
      ]);

    // Calculate net income
    const totalRevenue = paymentStats._sum.amount || 0;
    const totalExpenses = expenseStats._sum.amount || 0;
    const netIncome = totalRevenue - totalExpenses;

    // Invoice status breakdown
    const invoiceStatusBreakdown = await prisma.invoice.groupBy({
      by: ["status"],
      where: invoiceWhere,
      _count: true,
      _sum: {
        totalAmount: true,
      },
    });

    // Expense category breakdown
    const expenseCategoryBreakdown = await prisma.expense.groupBy({
      by: ["category"],
      where: expenseWhere,
      _count: true,
      _sum: {
        amount: true,
      },
    });

    res.json({
      success: true,
      message: "Financial overview retrieved successfully",
      data: {
        summary: {
          totalInvoices: invoiceStats._count,
          totalInvoiceAmount: invoiceStats._sum.totalAmount || 0,
          totalAmountPaid: invoiceStats._sum.amountPaid || 0,
          totalAmountDue: invoiceStats._sum.amountDue || 0,
          totalPayments: paymentStats._count,
          totalRevenue,
          totalExpenses,
          netIncome,
          expenseCount: expenseStats._count,
        },
        invoiceStatusBreakdown,
        expenseCategoryBreakdown,
        recentTransactions,
      },
    });
  } catch (error) {
    logger.error("Error fetching financial overview:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getStudentFinancialReport = async (
  req: Request,
  res: Response
) => {
  try {
    const { studentId, schoolId } = req.params;
    const { termId, sessionId } = req.query;

    // Verify student belongs to school
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        student_enrolled: {
          some: {
            class: {
              schoolId,
            },
            status: "enrolled",
          },
        },
      },
      select: {
        id: true,
        name: true,
        admission_number: true,
        email: true,
      },
    });

    if (!student) {
      handleError(res, "Student not found", 404);
      return;
    }

    const invoiceWhere: any = {
      schoolId,
      studentInvoices: {
        some: {
          studentId,
        },
      },
    };
    if (termId) invoiceWhere.termId = termId;
    if (sessionId) invoiceWhere.sessionId = sessionId;

    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          invoiceItems: {
            include: {
              feeCategory: true,
            },
          },
          term: true,
          session: true,
        },
        orderBy: { createdAt: "desc" },
      }),

      prisma.payment.findMany({
        where: {
          studentId,
          schoolId,
        },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Calculate totals
    const totalInvoiceAmount = invoices.reduce(
      (sum, inv) => sum + inv.totalAmount,
      0
    );
    const totalPaidAmount = payments
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalOutstanding = totalInvoiceAmount - totalPaidAmount;

    res.json({
      success: true,
      message: "Student financial report retrieved successfully",
      data: {
        student,
        summary: {
          totalInvoiceAmount,
          totalPaidAmount,
          totalOutstanding,
          invoiceCount: invoices.length,
          paymentCount: payments.filter((p) => p.status === "COMPLETED").length,
        },
        invoices,
        payments,
      },
    });
  } catch (error) {
    logger.error("Error fetching student financial report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getPaymentReport = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { startDate, endDate, classId, sectionId, paymentMethod } = req.query;

    const where: any = { schoolId, status: "COMPLETED" };

    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) where.paidAt.gte = new Date(startDate as string);
      if (endDate) where.paidAt.lte = new Date(endDate as string);
    }

    if (paymentMethod) where.paymentMethod = paymentMethod;

    let studentFilter: any = {};
    if (classId || sectionId) {
      studentFilter = {
        student_enrolled: {
          some: {
            isActive: true,
            ...(classId && { classId }),
            ...(sectionId && { sectionId }),
          },
        },
      };
    }

    const payments = await prisma.payment.findMany({
      where: {
        ...where,
        ...(Object.keys(studentFilter).length > 0 && {
          student: studentFilter,
        }),
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            admission_number: true,
            student_enrolled: {
              where: { status: "enrolled" },
              include: {
                class: {
                  select: {
                    name: true,
                  },
                },
                section: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        invoice: {
          select: {
            invoiceNumber: true,
            title: true,
          },
        },
      },
      orderBy: { paidAt: "desc" },
    });

    // Calculate summary statistics
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const paymentMethodBreakdown = payments.reduce(
      (acc, p) => {
        acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + p.amount;
        return acc;
      },
      {} as Record<string, number>
    );

    res.json({
      success: true,
      message: "Payment report retrieved successfully",
      data: {
        summary: {
          totalAmount,
          paymentCount: payments.length,
          paymentMethodBreakdown,
        },
        payments,
      },
    });
  } catch (error) {
    logger.error("Error fetching payment report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Webhook handler for payment gateways
export const handlePaymentWebhook = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const payload = req.body;

    // Store webhook for processing
    const webhook = await prisma.paymentWebhook.create({
      data: {
        provider,
        eventType: payload.event || payload.type || "unknown",
        payload,
        processed: false,
      },
    });

    // Process webhook based on provider
    // This would typically be handled by a background job
    // For now, we'll just acknowledge receipt

    logger.info(`Payment webhook received: ${webhook.id} from ${provider}`);

    res.status(200).json({
      success: true,
      message: "Webhook received successfully",
    });
  } catch (error) {
    logger.error("Error handling payment webhook:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
