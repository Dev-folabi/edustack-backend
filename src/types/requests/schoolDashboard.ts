export interface SchoolDashboardQuery {
  startDate?: string;
  endDate?: string;
}

export interface SchoolDashboardResponse {
  overview: {
    totalStudents: number;
    activeStudents: number;
    totalStaff: number;
    activeStaff: number;
    totalClasses: number;
    totalSections: number;
  };
  academicInfo: {
    currentSession: {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
      isActive: boolean;
    } | null;
    currentTerm: {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
      isActive: boolean;
    } | null;
  };
  financialSummary: {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    totalInvoices: number;
    totalInvoiceAmount: number;
    totalAmountPaid: number;
    totalAmountDue: number;
    collectionRate: number;
  };
  studentBreakdown: {
    byGender: Array<{
      gender: "male" | "female";
      count: number;
    }>;
    byClass: Array<{
      classId: string;
      className: string;
      studentCount: number;
      sections: Array<{
        sectionId: string;
        sectionName: string;
        studentCount: number;
      }>;
    }>;
  };
  staffBreakdown: {
    byRole: Array<{
      role: "admin" | "teacher" | "finance" | "librarian" | "other";
      count: number;
    }>;
    byGender: Array<{
      gender: "male" | "female";
      count: number;
    }>;
  };
  recentAdmissions: Array<{
    id: string;
    name: string;
    admissionNumber: string | null;
    admission_date: string;
    gender: "male" | "female";
    class: {
      id: string;
      name: string;
    } | null;
    section: {
      id: string;
      name: string;
    } | null;
    photo_url: string | null;
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    description: string;
    eventDate: string;
    eventType: "exam" | "holiday" | "meeting" | "other";
  }>;
  examinations: {
    upcomingExams: number;
    ongoingExams: number;
    completedExams: number;
    pendingResults: number;
  };
  attendance: {
    todayPresent: number;
    todayAbsent: number;
    todayTotal: number;
    attendanceRate: number;
    lastUpdated: string;
  };
}
