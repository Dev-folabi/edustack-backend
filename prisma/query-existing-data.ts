/**
 * Script to query existing database data to understand the current state
 * Run with: npx ts-node prisma/query-existing-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function queryExistingData() {
  console.log("=== Querying Existing Database Data ===\n");

  // 1. Schools
  const schools = await prisma.school.findMany({
    include: {
      classes: true,
      sessions: true,
    },
  });
  console.log(`📚 Schools (${schools.length}):`);
  schools.forEach((s) => {
    console.log(`  - ${s.name} (ID: ${s.id})`);
    console.log(
      `    Classes: ${s.classes.length}, Sessions: ${s.sessions.length}`
    );
  });

  // 2. Users and their roles
  const users = await prisma.user.findMany({
    include: {
      userSchools: true,
      student: true,
      staff: true,
      parent: true,
    },
  });
  console.log(`\n👥 Users (${users.length}):`);
  users.forEach((u) => {
    const roles = u.userSchools.map((us) => us.role).join(", ");
    const type = u.student
      ? "Student"
      : u.staff
        ? "Staff"
        : u.parent
          ? "Parent"
          : "Basic";
    console.log(
      `  - ${u.username} | ${u.email || "no-email"} | Type: ${type} | Roles: ${roles || "none"} | SuperAdmin: ${u.isSuperAdmin}`
    );
  });

  // 3. Sessions and Terms
  const sessions = await prisma.session.findMany({
    include: {
      terms: true,
    },
  });
  console.log(`\n📅 Sessions (${sessions.length}):`);
  sessions.forEach((s) => {
    console.log(
      `  - ${s.name} (ID: ${s.id}) | Active: ${s.isActive} | SchoolId: ${s.schoolId}`
    );
    s.terms.forEach((t) => {
      console.log(`      Term: ${t.name} | Active: ${t.isActive}`);
    });
  });

  // 4. Classes and Sections
  const classes = await prisma.classes.findMany({
    include: {
      sections: true,
    },
  });
  console.log(`\n🏫 Classes (${classes.length}):`);
  classes.forEach((c) => {
    console.log(`  - ${c.name} (ID: ${c.id}) | SchoolId: ${c.schoolId}`);
    c.sections.forEach((sec) => {
      console.log(`      Section: ${sec.name} (ID: ${sec.id})`);
    });
  });

  // 5. Subjects
  const subjects = await prisma.subject.findMany({
    include: {
      schools: true,
      sections: true,
    },
  });
  console.log(`\n📖 Subjects (${subjects.length}):`);
  subjects.forEach((s) => {
    console.log(
      `  - ${s.name} (ID: ${s.id}) | Code: ${s.code} | Schools: ${s.schools.length} | Sections: ${s.sections.length}`
    );
  });

  // 6. Students
  const students = await prisma.student.findMany({
    include: {
      student_enrolled: true,
      user: true,
    },
  });
  console.log(`\n🎓 Students (${students.length}):`);
  students.forEach((s) => {
    console.log(
      `  - ${s.name} (ID: ${s.id}) | Adm#: ${s.admission_number} | SchoolId: ${s.schoolId}`
    );
    console.log(`    Enrollments: ${s.student_enrolled.length}`);
  });

  // 7. Staff
  const staff = await prisma.staff.findMany({
    include: {
      user: true,
    },
  });
  console.log(`\n👨‍🏫 Staff (${staff.length}):`);
  staff.forEach((s) => {
    console.log(`  - ${s.name} (ID: ${s.id}) | Designation: ${s.designation}`);
  });

  // 8. Parents
  const parents = await prisma.parent.findMany({
    include: {
      students: true,
    },
  });
  console.log(`\n👪 Parents (${parents.length}):`);
  parents.forEach((p) => {
    console.log(`  - ${p.name} (ID: ${p.id}) | Children: ${p.students.length}`);
  });

  // 9. Fee Categories
  const feeCategories = await prisma.feeCategory.findMany();
  console.log(`\n💰 Fee Categories (${feeCategories.length}):`);
  feeCategories.forEach((f) => {
    console.log(`  - ${f.name} (ID: ${f.id}) | SchoolId: ${f.schoolId}`);
  });

  // 10. Invoices
  const invoices = await prisma.invoice.findMany({
    include: {
      invoiceItems: true,
      studentInvoices: true,
    },
  });
  console.log(`\n🧾 Invoices (${invoices.length}):`);
  invoices.forEach((i) => {
    console.log(
      `  - ${i.title} (#${i.invoiceNumber}) | Items: ${i.invoiceItems.length} | Assigned: ${i.studentInvoices.length}`
    );
  });

  // 11. Exams and related
  const exams = await prisma.exam.findMany({
    include: {
      papers: true,
    },
  });
  console.log(`\n📝 Exams (${exams.length}):`);
  exams.forEach((e) => {
    console.log(
      `  - ${e.title} (ID: ${e.id}) | Papers: ${e.papers.length} | Status: ${e.status}`
    );
  });

  // 11b. Results
  const resultCount = await prisma.result.count();
  const attemptCount = await prisma.examAttempt.count();
  console.log(`\n🏆 Results & Attempts:`);
  console.log(`  - Total Exam Attempts: ${attemptCount}`);
  console.log(`  - Total Published Results: ${resultCount}`);

  // 12. Question Banks
  const questionBanks = await prisma.questionBank.findMany({
    include: {
      questions: true,
    },
  });
  console.log(`\n❓ Question Banks (${questionBanks.length}):`);
  questionBanks.forEach((qb) => {
    console.log(
      `  - ${qb.name} (ID: ${qb.id}) | Questions: ${qb.questions.length}`
    );
  });

  // 13. Timetables
  const timetables = await prisma.timetable.findMany({
    include: {
      entries: true,
    },
  });
  console.log(`\n⏰ Timetables (${timetables.length}):`);
  timetables.forEach((t) => {
    console.log(`  - ${t.name} (ID: ${t.id}) | Entries: ${t.entries.length}`);
  });

  // 14. Attendance
  const attendanceCount = await prisma.attendance.count();
  console.log(`\n✅ Attendance Records: ${attendanceCount}`);

  // 15. Grade Criteria
  const gradeCriteria = await prisma.gradeCriteria.findMany();
  console.log(`\n📊 Grade Criteria (${gradeCriteria.length}):`);
  gradeCriteria.forEach((g) => {
    console.log(
      `  - ${g.name}: ${g.minScore} - ${g.maxScore} | Remark: ${g.remark}`
    );
  });

  // 16. Psychomotor Skills
  const psychomotorSkills = await prisma.psychomotorSkill.findMany();
  console.log(`\n🎯 Psychomotor Skills (${psychomotorSkills.length}):`);
  psychomotorSkills.forEach((p) => {
    console.log(`  - ${p.name} (ID: ${p.id})`);
  });

  // 17. Payment Gateways
  const paymentGateways = await prisma.paymentGateway.findMany();
  console.log(`\n💳 Payment Gateways (${paymentGateways.length}):`);
  paymentGateways.forEach((pg) => {
    console.log(
      `  - ${pg.provider} | SchoolId: ${pg.schoolId} | Active: ${pg.isActive}`
    );
  });

  // 18. Payments
  const payments = await prisma.payment.findMany();
  console.log(`\n💵 Payments (${payments.length}):`);
  payments.forEach((p) => {
    console.log(
      `  - #${p.paymentNumber} | Amount: ${p.amount} | Status: ${p.status}`
    );
  });

  // 19. Notifications
  const notificationCount = await prisma.notification.count();
  console.log(`\n🔔 Notifications: ${notificationCount}`);

  // 20. Expenses
  const expenses = await prisma.expense.findMany();
  console.log(`\n📋 Expenses (${expenses.length}):`);
  expenses.forEach((e) => {
    console.log(
      `  - ${e.title} | Amount: ${e.amount} | Category: ${e.category}`
    );
  });

  // 21. Global Exam Settings
  const globalExamSettings = await prisma.globalExamSettings.findMany();
  console.log(`\n⚙️ Global Exam Settings (${globalExamSettings.length}):`);
  globalExamSettings.forEach((g) => {
    console.log(`  - SchoolId: ${g.schoolId} | Pass Mark: ${g.passMark}`);
  });

  console.log("\n=== Query Complete ===");
}

queryExistingData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
