export interface CreateFeeCategoryRequest {
  name: string;
  schoolId: string;
  description?: string;
}

export interface UpdateFeeCategoryRequest {
  name?: string;
  description?: string;
}

export interface UpdateInvoiceRequest {
  title?: string;
  description?: string;
  dueDate?: string;
  status?:
    | "DRAFT"
    | "SENT"
    | "PAID"
    | "PARTIALLY_PAID"
    | "OVERDUE"
    | "CANCELLED";

  allowPartialPayment?: boolean;
}

export interface CreateAndAssignInvoiceRequest {
  title: string;
  description?: string;
  dueDate?: string;
  termId?: string;
  sessionId?: string;
  schoolId: string;
  allowPartialPayment?: boolean;
  items: {
    feeCategoryId: string;
    description?: string;
    amount: number;
  }[];
  // Assignment details
  assignmentType: "SINGLE_STUDENT" | "MULTIPLE_STUDENTS" | "CLASS" | "SECTION";
  studentIds?: string[];
  classId?: string;
  sectionId?: string;
}

export interface CreatePaymentRequest {
  invoiceId: string;
  schoolId: string;
  studentId: string;
  amount: number;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CARD" | "MOBILE_MONEY" | "CHEQUE";
  transactionRef?: string;
}

export interface CreateExpenseRequest {
  title: string;
  description?: string;
  amount: number;
  schoolId: string;
  category:
    | "UTILITIES"
    | "SUPPLIES"
    | "MAINTENANCE"
    | "SALARIES"
    | "TRANSPORT"
    | "MARKETING"
    | "OTHER";
  receiptUrl?: string;
  expenseDate: string;
}

export interface UpdateExpenseRequest {
  title?: string;
  description?: string;
  amount?: number;
  category?:
    | "UTILITIES"
    | "SUPPLIES"
    | "MAINTENANCE"
    | "SALARIES"
    | "TRANSPORT"
    | "MARKETING"
    | "OTHER";
  receiptUrl?: string;
  expenseDate?: string;
}

export interface CreatePaymentGatewayRequest {
  schoolId: string;
  name: string;
  provider: string;
  config: Record<string, any>;
}

export interface UpdatePaymentGatewayRequest {
  name?: string;
  isActive?: boolean;
  config?: Record<string, any>;
}

export interface FinancialReportQuery {
  startDate?: string;
  endDate?: string;
  termId?: string;
  sessionId?: string;
  classId?: string;
  sectionId?: string;
}
