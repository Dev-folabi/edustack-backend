/**
 * Comprehensive Database Seed Script for EduStack Auth Microservice
 *
 * This script extends existing database data with comprehensive test data.
 * Run with: npx prisma db seed
 *
 * Existing Data Summary (from query):
 * - 2 Schools: Greenfield Academy (cmhtwbprl0002n5ymb0um8m7w), Springfield High (cmipxc55o0000n5pna2qn5mxa)
 * - 7 Users (superadmin, 2 admins, 1 teacher, 1 finance, 1 student user, 1 parent)
 * - 4 Sessions with Terms
 * - 2 Classes (Grade 1, Grade 2) with Sections A/B
 * - 8 Subjects (duplicates for Math and English)
 * - 3 Students, 4 Staff, 1 Parent
 * - 4 Fee Categories, 2 Invoices, 3 Exams, 2 Question Banks
 * - Various other records
 *
 * This seed will ADD more data without destroying existing records.
 */

import {
  PrismaClient,
  Gender,
  UserRole,
  EnrollStatus,
  AttendanceStatus,
  AttendanceType,
  WeekDay,
  PeriodType,
  QuestionType,
  DifficultyLevel,
  AttemptStatus,
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
  ExpenseCategory,
  NotificationCategory,
  NotificationType,
  Prisma,
  Classes,
  Class_Section,
  Subject,
  Parent,
  Student,
  Staff,
  QuestionBank,
  Timetable,
  Invoice,
  Expense,
} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Constants
const DEFAULT_PASSWORD = "Password123!";
const SALT_ROUNDS = 10;

// Existing IDs from database query
const EXISTING = {
  schools: {
    greenfieldAcademy: "cmhtwbprl0002n5ymb0um8m7w",
    springfieldHigh: "cmipxc55o0000n5pna2qn5mxa",
  },
  sessions: {
    "2025/2026_greenfield": "cmhuij8dw0000n5idz3xx2v4x",
    "2025/2026_springfield": "cmitk31du0001n5bl1kgfhwyw",
  },
  classes: {
    grade1: "cmhuildi50008n5idnzzjbu1p",
    grade2: "cmhuilslj000cn5idk0aelnmc",
  },
  sections: {
    grade1A: "cmhuile220009n5id03fwq39b",
    grade1B: "cmhuile22000an5idthdtka06",
    grade2A: "cmhuilsu2000dn5idwazupcm5",
    grade2B: "cmhuilsu2000en5id5x6elod2",
  },
  subjects: {
    math1: "cmhuj1cr9000fn5idg5gp3gyw",
    english1: "cmijhr1bl0000n59vtdwo1y7c",
  },
  students: {
    yusufHamid: "cmhujbuww000qn5idoppjw1p0",
    hassanJamiu: "cmik6cfeh0004n5ojfrdku6as",
    ngoziJude: "cmhusryo9000xn5idd915wmow",
  },
  parents: {
    yusuf: "cmhujbtij000ln5idslzo9n25",
  },
  staff: {
    admin: "cmiind9oh0004n5kpd4yqpasn",
    teacher: "cmiinjgt50009n5kpmwt05zjb",
    accountant: "cmiinvz6o000en5kp7ctnwr29",
    sodiq: "cmitj7l2j000gn5htct9ryzaa",
  },
  feeCategories: {
    uniform: "cmhusyn8g0011n5idxzmzriv8",
    schoolFees: "cmhusznhz0013n5idasfvxk6v",
    textbook: "cmhut00xi0015n5idftv11peo",
    excursion: "cmhut15uy0017n5idrylwp9cr",
  },
  questionBanks: {
    english: "cmikxnje40003n53j0vzea7eb",
    math: "cmikxmbeo0001n53jdqe9krh6",
  },
  psychomotorSkills: {
    punctuality: "cmime6skc001rn5v26c5optdn",
    neatness: "cmime75jg001tn5v2pmzqyqxw",
    sports: "cmime7d7k001vn5v20nl5xobs",
    handwriting: "cmime7xit001xn5v2e5i9e9fa",
  },
};

// Helper function to hash passwords
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Helper function to generate unique admission number
function generateAdmissionNumber(index: number): string {
  return String(index).padStart(6, "0");
}

// Helper function to generate invoice number
function generateInvoiceNumber(year: number, index: number): string {
  return `INV-${year}-${String(index).padStart(4, "0")}`;
}

// Helper function to generate payment number
function generatePaymentNumber(year: number, index: number): string {
  return `PAY-${year}-${String(index).padStart(6, "0")}`;
}

// Helper function to get realistic questions for subjects
function getQuestionsForSubject(subjectName: string): any[] {
  const questions: any[] = [];

  switch (subjectName) {
    case "Basic Science":
      questions.push(
        {
          type: QuestionType.MCQ,
          text: "What is the unit of force?",
          options: ["Newton", "Joule", "Watt", "Pascal"],
          answer: "Newton",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.MCQ,
          text: "Which planet is known as the Red Planet?",
          options: ["Venus", "Mars", "Jupiter", "Saturn"],
          answer: "Mars",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.MCQ,
          text: "What is the chemical symbol for Water?",
          options: ["H2O", "CO2", "O2", "NaCl"],
          answer: "H2O",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.MCQ,
          text: "Which organ pumps blood in the body?",
          options: ["Liver", "Heart", "Brain", "Kidney"],
          answer: "Heart",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.MCQ,
          text: "What gas do plants absorb from the atmosphere?",
          options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
          answer: "Carbon Dioxide",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.TrueFalse,
          text: "Water boils at 100 degrees Celsius.",
          options: ["True", "False"],
          answer: "True",
          marks: 1,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.TrueFalse,
          text: "The sun revolves around the earth.",
          options: ["True", "False"],
          answer: "False",
          marks: 1,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.TrueFalse,
          text: "Humans have 46 chromosomes.",
          options: ["True", "False"],
          answer: "True",
          marks: 1,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.TrueFalse,
          text: "Sound travels faster in vacuum than in air.",
          options: ["True", "False"],
          answer: "False",
          marks: 1,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "The chemical symbol for Gold is ____.",
          options: null,
          answer: "Au",
          marks: 2,
          diff: DifficultyLevel.Hard,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "The hardest natural substance is ____.",
          options: null,
          answer: "Diamond",
          marks: 2,
          diff: DifficultyLevel.Hard,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "Photosynthesis takes place in the ____ of a plant.",
          options: null,
          answer: "Leaves",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "The force that pulls objects towards the earth is ____.",
          options: null,
          answer: "Gravity",
          marks: 2,
          diff: DifficultyLevel.Medium,
        }
      );
      break;
    case "Social Studies":
      questions.push(
        {
          type: QuestionType.MCQ,
          text: "What is the capital of Nigeria?",
          options: ["Lagos", "Abuja", "Kano", "Port Harcourt"],
          answer: "Abuja",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.MCQ,
          text: "Democracy is a government of the people, by the people, and for the ____.",
          options: ["Leaders", "People", "Military", "Rich"],
          answer: "People",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.MCQ,
          text: "Which of these is NOT a cardinal point?",
          options: ["North", "South", "Center", "West"],
          answer: "Center",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.MCQ,
          text: "The coat of arms of Nigeria has an eagle mounted on a ____.",
          options: ["White Horse", "Black Shield", "Green Wreath", "Red Band"],
          answer: "Black Shield",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.MCQ,
          text: "Who is the current president of Nigeria?",
          options: [
            "Bola Ahmed Tinubu",
            "Muhammadu Buhari",
            "Goodluck Jonathan",
            "Olusegun Obasanjo",
          ],
          answer: "Bola Ahmed Tinubu",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.TrueFalse,
          text: "Nigeria became independent in 1960.",
          options: ["True", "False"],
          answer: "True",
          marks: 1,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.TrueFalse,
          text: "The Niger River is the longest river in Nigeria.",
          options: ["True", "False"],
          answer: "True",
          marks: 1,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.TrueFalse,
          text: "Lagos is the capital of Nigeria.",
          options: ["True", "False"],
          answer: "False",
          marks: 1,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.TrueFalse,
          text: "There are 36 states in Nigeria.",
          options: ["True", "False"],
          answer: "True",
          marks: 1,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "The colors of the Nigerian flag are Green and ____.",
          options: null,
          answer: "White",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "The giant of Africa is a nickname for ____.",
          options: null,
          answer: "Nigeria",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "A nuclear family consists of father, mother and ____.",
          options: null,
          answer: "Children",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "The currency used in Nigeria is ____.",
          options: null,
          answer: "Naira",
          marks: 2,
          diff: DifficultyLevel.Easy,
        }
      );
      break;
    case "Computer Studies":
      questions.push(
        {
          type: QuestionType.MCQ,
          text: "What does CPU stand for?",
          options: [
            "Central Processing Unit",
            "Central Power Unit",
            "Computer Power Unit",
            "Central Process Unit",
          ],
          answer: "Central Processing Unit",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.MCQ,
          text: "Which of these is an input device?",
          options: ["Monitor", "Printer", "Mouse", "Speaker"],
          answer: "Mouse",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.MCQ,
          text: "Which key is used to delete characters to the left of the cursor?",
          options: ["Delete", "Backspace", "Shift", "Enter"],
          answer: "Backspace",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.MCQ,
          text: "The brain of the computer is the ____.",
          options: ["Monitor", "Keyboard", "CPU", "Mouse"],
          answer: "CPU",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.MCQ,
          text: "Which of these is an operating system?",
          options: ["Google Chrome", "Microsoft Word", "Windows", "Python"],
          answer: "Windows",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.TrueFalse,
          text: "A keyboard is an output device.",
          options: ["True", "False"],
          answer: "False",
          marks: 1,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.TrueFalse,
          text: "RAM stores data permanently.",
          options: ["True", "False"],
          answer: "False",
          marks: 1,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.TrueFalse,
          text: "A virus can damage your computer.",
          options: ["True", "False"],
          answer: "True",
          marks: 1,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.TrueFalse,
          text: "The internet is a global network of computers.",
          options: ["True", "False"],
          answer: "True",
          marks: 1,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "RAM stands for Random ____ Memory.",
          options: null,
          answer: "Access",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "ROM stands for Read ____ Memory.",
          options: null,
          answer: "Only",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "WWW stands for World Wide ____.",
          options: null,
          answer: "Web",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.FillInBlanks,
          text: "The physical parts of a computer are called ____.",
          options: null,
          answer: "Hardware",
          marks: 2,
          diff: DifficultyLevel.Medium,
        }
      );
      break;
    default:
      // Generic questions for other subjects
      questions.push(
        {
          type: QuestionType.MCQ,
          text: `What is a key concept in ${subjectName}?`,
          options: ["Concept A", "Concept B", "Concept C", "Concept D"],
          answer: "Concept A",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.MCQ,
          text: `Which tool is used in ${subjectName}?`,
          options: ["Tool X", "Tool Y", "Tool Z", "Tool W"],
          answer: "Tool X",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.MCQ,
          text: `Who is a famous figure in ${subjectName}?`,
          options: ["Person A", "Person B", "Person C", "Person D"],
          answer: "Person A",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.MCQ,
          text: `What is the primary goal of ${subjectName}?`,
          options: ["Goal 1", "Goal 2", "Goal 3", "Goal 4"],
          answer: "Goal 1",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.MCQ,
          text: `Which term is associated with ${subjectName}?`,
          options: ["Term 1", "Term 2", "Term 3", "Term 4"],
          answer: "Term 1",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.TrueFalse,
          text: `${subjectName} is important for development.`,
          options: ["True", "False"],
          answer: "True",
          marks: 1,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.TrueFalse,
          text: `${subjectName} involves practical skills.`,
          options: ["True", "False"],
          answer: "True",
          marks: 1,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.TrueFalse,
          text: `${subjectName} is only theoretical.`,
          options: ["True", "False"],
          answer: "False",
          marks: 1,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.TrueFalse,
          text: `Everyone should learn ${subjectName}.`,
          options: ["True", "False"],
          answer: "True",
          marks: 1,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.FillInBlanks,
          text: `${subjectName} helps in ____ thinking.`,
          options: null,
          answer: "Critical",
          marks: 2,
          diff: DifficultyLevel.Medium,
        },
        {
          type: QuestionType.FillInBlanks,
          text: `The study of ${subjectName} began in the ____ century.`,
          options: null,
          answer: "19th",
          marks: 2,
          diff: DifficultyLevel.Hard,
        },
        {
          type: QuestionType.FillInBlanks,
          text: `One benefit of ${subjectName} is ____.`,
          options: null,
          answer: "Knowledge",
          marks: 2,
          diff: DifficultyLevel.Easy,
        },
        {
          type: QuestionType.FillInBlanks,
          text: `____ is a major topic in ${subjectName}.`,
          options: null,
          answer: "Topic X",
          marks: 2,
          diff: DifficultyLevel.Medium,
        }
      );
  }
  return questions;
}

async function main() {
  console.log("🌱 Starting comprehensive database seeding...\n");

  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

  // ========================================
  // 1. CREATE ADDITIONAL CLASSES (Grade 3-6)
  // ========================================
  console.log("📚 Creating additional classes...");

  const newClasses: Classes[] = await Promise.all([
    prisma.classes.upsert({
      where: {
        name_schoolId: {
          name: "GRADE 3",
          schoolId: EXISTING.schools.greenfieldAcademy,
        },
      },
      update: {},
      create: {
        name: "GRADE 3",
        schoolId: EXISTING.schools.greenfieldAcademy,
      },
    }),
    prisma.classes.upsert({
      where: {
        name_schoolId: {
          name: "GRADE 4",
          schoolId: EXISTING.schools.greenfieldAcademy,
        },
      },
      update: {},
      create: {
        name: "GRADE 4",
        schoolId: EXISTING.schools.greenfieldAcademy,
      },
    }),
    prisma.classes.upsert({
      where: {
        name_schoolId: {
          name: "GRADE 5",
          schoolId: EXISTING.schools.greenfieldAcademy,
        },
      },
      update: {},
      create: {
        name: "GRADE 5",
        schoolId: EXISTING.schools.greenfieldAcademy,
      },
    }),
    prisma.classes.upsert({
      where: {
        name_schoolId: {
          name: "GRADE 6",
          schoolId: EXISTING.schools.greenfieldAcademy,
        },
      },
      update: {},
      create: {
        name: "GRADE 6",
        schoolId: EXISTING.schools.greenfieldAcademy,
      },
    }),
  ]);
  console.log(`  Created/verified ${newClasses.length} additional classes`);

  // Create sections for new classes
  const newSections: Class_Section[] = [];
  for (const cls of newClasses) {
    const sectionA = await prisma.class_Section.upsert({
      where: { classId_name: { classId: cls.id, name: "A" } },
      update: {},
      create: { classId: cls.id, name: "A" },
    });
    const sectionB = await prisma.class_Section.upsert({
      where: { classId_name: { classId: cls.id, name: "B" } },
      update: {},
      create: { classId: cls.id, name: "B" },
    });
    newSections.push(sectionA, sectionB);
  }
  console.log(
    `  Created/verified ${newSections.length} sections for new classes`
  );

  // ========================================
  // 2. CREATE ADDITIONAL SUBJECTS
  // ========================================
  console.log("\n📖 Creating additional subjects...");

  const subjectNames = [
    { name: "Basic Science", code: "SCI101" },
    { name: "Social Studies", code: "SOC101" },
    { name: "Computer Studies", code: "ICT101" },
    { name: "Physical Education", code: "PE101" },
    { name: "Fine Arts", code: "ART101" },
    { name: "Music", code: "MUS101" },
    { name: "French", code: "FRE101" },
    { name: "Agricultural Science", code: "AGR101" },
    { name: "Home Economics", code: "HEC101" },
    { name: "Civic Education", code: "CIV101" },
  ];

  const newSubjects: Subject[] = [];
  for (const subj of subjectNames) {
    const subject = await prisma.subject.create({
      data: {
        name: subj.name,
        code: subj.code,
        isActive: true,
      },
    });
    newSubjects.push(subject);

    // Link to school
    await prisma.subjectSchool.upsert({
      where: {
        subjectId_schoolId: {
          subjectId: subject.id,
          schoolId: EXISTING.schools.greenfieldAcademy,
        },
      },
      update: {},
      create: {
        subjectId: subject.id,
        schoolId: EXISTING.schools.greenfieldAcademy,
      },
    });

    // Link to sections (Grade 1A and 1B)
    await prisma.subjectSection.upsert({
      where: {
        subjectId_sectionId: {
          subjectId: subject.id,
          sectionId: EXISTING.sections.grade1A,
        },
      },
      update: {},
      create: { subjectId: subject.id, sectionId: EXISTING.sections.grade1A },
    });
  }
  console.log(
    `  Created ${newSubjects.length} new subjects with school/section links`
  );

  // ========================================
  // 3. CREATE ADDITIONAL PARENTS
  // ========================================
  console.log("\n👪 Creating additional parents...");

  const parentData = [
    {
      name: "Adebayo Oluwatobi",
      email: "adebayo.oluwatobi@email.com",
      phone: "+2348012345678",
    },
    {
      name: "Chidinma Okafor",
      email: "chidinma.okafor@email.com",
      phone: "+2348023456789",
    },
    {
      name: "Funke Adeleke",
      email: "funke.adeleke@email.com",
      phone: "+2348034567890",
    },
    {
      name: "Ibrahim Musa",
      email: "ibrahim.musa@email.com",
      phone: "+2348045678901",
    },
    {
      name: "Grace Emenike",
      email: "grace.emenike@email.com",
      phone: "+2348056789012",
    },
  ];

  const newParents: Parent[] = [];
  for (let i = 0; i < parentData.length; i++) {
    const pd = parentData[i];
    const username = `parent${i + 2}`;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) continue;

    const user = await prisma.user.create({
      data: {
        email: pd.email,
        username,
        password: hashedPassword,
        hasVerifiedEmail: true,
      },
    });

    const parent = await prisma.parent.create({
      data: {
        userId: user.id,
        name: pd.name,
        phone: pd.phone,
        email: pd.email,
      },
    });
    newParents.push(parent);
  }
  console.log(`  Created ${newParents.length} new parents`);

  // ========================================
  // 4. CREATE ADDITIONAL STUDENTS
  // ========================================
  console.log("\n🎓 Creating additional students...");

  const studentData = [
    {
      name: "Chukwuemeka Adebayo",
      gender: Gender.male,
      dob: new Date("2015-03-15"),
      address: "12 Adeola Street, Lagos",
    },
    {
      name: "Aisha Ibrahim",
      gender: Gender.female,
      dob: new Date("2015-07-22"),
      address: "45 Ahmadu Bello Way, Abuja",
    },
    {
      name: "Olumide Okonkwo",
      gender: Gender.male,
      dob: new Date("2014-11-08"),
      address: "78 Awolowo Road, Ibadan",
    },
    {
      name: "Ngozi Eze",
      gender: Gender.female,
      dob: new Date("2016-01-30"),
      address: "23 Nnamdi Azikiwe Street, Enugu",
    },
    {
      name: "Tunde Bakare",
      gender: Gender.male,
      dob: new Date("2015-05-18"),
      address: "56 Ojuelegba Road, Lagos",
    },
    {
      name: "Amina Bello",
      gender: Gender.female,
      dob: new Date("2014-09-25"),
      address: "89 Sultan Road, Sokoto",
    },
    {
      name: "Emeka Nwankwo",
      gender: Gender.male,
      dob: new Date("2016-04-12"),
      address: "34 Azikiwe Avenue, Onitsha",
    },
    {
      name: "Fatima Abubakar",
      gender: Gender.female,
      dob: new Date("2015-12-03"),
      address: "67 Kano Road, Kaduna",
    },
    {
      name: "Segun Adeyemi",
      gender: Gender.male,
      dob: new Date("2014-08-20"),
      address: "90 Western Avenue, Lagos",
    },
    {
      name: "Chinyere Okoro",
      gender: Gender.female,
      dob: new Date("2016-02-14"),
      address: "12 Oba Akran Avenue, Ikeja",
    },
    {
      name: "Musa Abdullahi",
      gender: Gender.male,
      dob: new Date("2015-06-28"),
      address: "45 Gombe Road, Bauchi",
    },
    {
      name: "Blessing Igwe",
      gender: Gender.female,
      dob: new Date("2014-10-10"),
      address: "78 Aba Road, Port Harcourt",
    },
  ];

  // Get first term for enrollment
  const activeTerm = await prisma.term.findFirst({
    where: {
      session: { schoolId: EXISTING.schools.greenfieldAcademy },
      isActive: true,
    },
  });

  const newStudents: Student[] = [];
  const sections = [
    EXISTING.sections.grade1A,
    EXISTING.sections.grade1B,
    EXISTING.sections.grade2A,
    EXISTING.sections.grade2B,
  ];
  const classes = [
    EXISTING.classes.grade1,
    EXISTING.classes.grade1,
    EXISTING.classes.grade2,
    EXISTING.classes.grade2,
  ];

  for (let i = 0; i < studentData.length; i++) {
    const sd = studentData[i];
    const username = `student${i + 4}`;
    const email = `student${i + 4}@email.com`;
    const admissionNumber = generateAdmissionNumber(i + 4);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      console.log(`  Skipping student ${username} - already exists`);
      continue;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        hasVerifiedEmail: true,
      },
    });

    // Assign to school with student role
    await prisma.userSchool.create({
      data: {
        userId: user.id,
        schoolId: EXISTING.schools.greenfieldAcademy,
        role: UserRole.student,
      },
    });

    // Assign parent (rotate through parents)
    const parentId =
      newParents.length > 0
        ? newParents[i % newParents.length].id
        : EXISTING.parents.yusuf;

    // Create student
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        schoolId: EXISTING.schools.greenfieldAcademy,
        parentId,
        name: sd.name,
        gender: sd.gender,
        dob: sd.dob,
        address: sd.address,
        admission_number: admissionNumber,
        admission_date: new Date(),
        isActive: true,
        isStudent: true,
        email,
      },
    });

    // Create enrollment
    const sectionIdx = i % sections.length;
    if (activeTerm) {
      await prisma.studentEnrollment.create({
        data: {
          studentId: student.id,
          classId: classes[sectionIdx],
          sectionId: sections[sectionIdx],
          sessionId: EXISTING.sessions["2025/2026_greenfield"],
          termId: activeTerm.id,
          status: EnrollStatus.enrolled,
        },
      });
    }

    newStudents.push(student);
  }
  console.log(`  Created ${newStudents.length} new students with enrollments`);

  // ========================================
  // 5. CREATE ADDITIONAL STAFF (TEACHERS)
  // ========================================
  console.log("\n👨‍🏫 Creating additional staff...");

  const staffData = [
    {
      name: "Mrs. Folake Adeniyi",
      designation: "Mathematics Teacher",
      email: "folake.adeniyi@school.com",
    },
    {
      name: "Mr. Chidi Obi",
      designation: "English Teacher",
      email: "chidi.obi@school.com",
    },
    {
      name: "Mrs. Amara Nwosu",
      designation: "Science Teacher",
      email: "amara.nwosu@school.com",
    },
    {
      name: "Mr. Tayo Ogundimu",
      designation: "Social Studies Teacher",
      email: "tayo.ogundimu@school.com",
    },
    {
      name: "Ms. Zainab Aliyu",
      designation: "Computer Teacher",
      email: "zainab.aliyu@school.com",
    },
    {
      name: "Mr. Efe Okoro",
      designation: "Physical Education Teacher",
      email: "efe.okoro@school.com",
    },
    {
      name: "Mrs. Bisi Adewale",
      designation: "Music Teacher",
      email: "bisi.adewale@school.com",
    },
    {
      name: "Mr. Uche Emenike",
      designation: "French Teacher",
      email: "uche.emenike@school.com",
    },
  ];

  const newStaff: Staff[] = [];
  for (let i = 0; i < staffData.length; i++) {
    const sd = staffData[i];
    const username = `teacher${i + 2}`;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      console.log(`  Skipping staff ${username} - already exists`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: sd.email,
        username,
        password: hashedPassword,
        hasVerifiedEmail: true,
      },
    });

    await prisma.userSchool.create({
      data: {
        userId: user.id,
        schoolId: EXISTING.schools.greenfieldAcademy,
        role: UserRole.teacher,
      },
    });

    const staff = await prisma.staff.create({
      data: {
        userId: user.id,
        name: sd.name,
        email: sd.email,
        phone: [`+23480${String(i + 10).padStart(8, "0")}`],
        address: `${i + 1} Staff Quarters, Greenfield Academy`,
        designation: sd.designation,
        gender: i % 2 === 0 ? Gender.female : Gender.male,
        salary: 150000 + i * 10000,
        isActive: true,
        dob: new Date(`198${i % 10}-0${(i % 9) + 1}-15`),
        joining_date: new Date("2024-01-15"),
        qualification: "B.Ed, M.Ed",
      },
    });

    // Assign as class teacher for some sections
    if (i < newSections.length) {
      await prisma.class_Section.update({
        where: { id: newSections[i].id },
        data: { teacherId: staff.id },
      });
    }

    // Assign to teach subjects
    if (i < newSubjects.length) {
      await prisma.subject.update({
        where: { id: newSubjects[i].id },
        data: { teacherId: staff.id },
      });
    }

    newStaff.push(staff);
  }
  console.log(`  Created ${newStaff.length} new staff members`);

  // ========================================
  // 6. CREATE ADDITIONAL QUESTION BANKS & QUESTIONS
  // ========================================
  console.log("\n❓ Creating additional question banks and questions...");

  // Create question banks for new subjects
  const questionBanks: QuestionBank[] = [];
  for (let i = 0; i < Math.min(5, newSubjects.length); i++) {
    const subject = newSubjects[i];
    const qb = await prisma.questionBank.upsert({
      where: {
        subjectId_name: {
          subjectId: subject.id,
          name: `${subject.name} - Grade 1 Question Bank`,
        },
      },
      update: {},
      create: {
        subjectId: subject.id,
        name: `${subject.name} - Grade 1 Question Bank`,
        description: `Comprehensive question bank for ${subject.name}`,
        createdById: EXISTING.staff.teacher,
      },
    });
    questionBanks.push(qb);

    // Delete existing questions to ensure clean state (removes old bad data)
    await prisma.question.deleteMany({ where: { bankId: qb.id } });

    // Create questions for each bank
    const questions: Prisma.QuestionCreateManyInput[] = [];
    const subjectQuestions = getQuestionsForSubject(subject.name);

    for (const q of subjectQuestions) {
      questions.push({
        bankId: qb.id,
        type: q.type,
        questionText: q.text,
        options: q.options, // Pass object/array directly, Prisma handles JSON serialization
        correctAnswer: q.answer, // Pass object/string directly
        marks: q.marks,
        difficulty: q.diff,
        createdById: EXISTING.staff.teacher,
      });
    }

    await prisma.question.createMany({ data: questions });
  }
  console.log(
    `  Created ${questionBanks.length} question banks with questions`
  );

  // ========================================
  // 7. CREATE ADDITIONAL ATTENDANCE RECORDS
  // ========================================
  console.log("\n✅ Creating additional attendance records...");

  const today = new Date();
  const attendanceRecords: Prisma.AttendanceCreateManyInput[] = [];

  // Get all students
  const allStudents = await prisma.student.findMany({
    where: { schoolId: EXISTING.schools.greenfieldAcademy },
  });

  // Create attendance for the past 5 school days
  for (let day = 1; day <= 5; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() - day);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (const student of allStudents) {
      // Random attendance status (mostly present)
      const statuses = [
        AttendanceStatus.PRESENT,
        AttendanceStatus.PRESENT,
        AttendanceStatus.PRESENT,
        AttendanceStatus.PRESENT,
        AttendanceStatus.LATE,
        AttendanceStatus.ABSENT,
      ];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      attendanceRecords.push({
        date,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        status,
        studentId: student.id,
        sectionId: EXISTING.sections.grade1A,
        attendanceType: AttendanceType.STUDENT,
        notes: status === AttendanceStatus.ABSENT ? "Parent notified" : null,
      });
    }
  }

  // Create staff attendance
  const allStaffMembers = await prisma.staff.findMany();
  for (let day = 1; day <= 5; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() - day);

    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (const staffMember of allStaffMembers) {
      attendanceRecords.push({
        date,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        status: AttendanceStatus.PRESENT,
        staffId: staffMember.id,
        attendanceType: AttendanceType.STAFF,
      });
    }
  }

  await prisma.attendance.createMany({
    data: attendanceRecords,
    skipDuplicates: true,
  });
  console.log(`  Created ${attendanceRecords.length} attendance records`);

  // ========================================
  // 8. CREATE ADDITIONAL TIMETABLES
  // ========================================
  console.log("\n⏰ Creating additional timetables...");

  // Create timetables for Grade 2
  const timetableData = [
    {
      name: "GRADE 2-A",
      sectionId: EXISTING.sections.grade2A,
      classId: EXISTING.classes.grade2,
    },
    {
      name: "GRADE 2-B",
      sectionId: EXISTING.sections.grade2B,
      classId: EXISTING.classes.grade2,
    },
  ];

  const newTimetables: Timetable[] = [];
  for (const tt of timetableData) {
    // Check if timetable exists
    const existing = await prisma.timetable.findFirst({
      where: {
        schoolId: EXISTING.schools.greenfieldAcademy,
        sectionId: tt.sectionId,
        sessionId: EXISTING.sessions["2025/2026_greenfield"],
      },
    });
    if (existing) continue;

    const timetable = await prisma.timetable.create({
      data: {
        name: tt.name,
        schoolId: EXISTING.schools.greenfieldAcademy,
        classId: tt.classId,
        sectionId: tt.sectionId,
        sessionId: EXISTING.sessions["2025/2026_greenfield"],
        status: "PUBLISHED",
      },
    });
    newTimetables.push(timetable);

    // Create entries for Monday through Friday
    const days = [
      WeekDay.MONDAY,
      WeekDay.TUESDAY,
      WeekDay.WEDNESDAY,
      WeekDay.THURSDAY,
      WeekDay.FRIDAY,
    ];
    const periods = [
      { start: "08:00", end: "08:45", type: PeriodType.ASSEMBLY },
      { start: "08:45", end: "09:30", type: PeriodType.REGULAR },
      { start: "09:30", end: "10:15", type: PeriodType.REGULAR },
      { start: "10:15", end: "10:45", type: PeriodType.BREAK },
      { start: "10:45", end: "11:30", type: PeriodType.REGULAR },
      { start: "11:30", end: "12:15", type: PeriodType.REGULAR },
      { start: "12:15", end: "13:00", type: PeriodType.LUNCH },
      { start: "13:00", end: "13:45", type: PeriodType.REGULAR },
      { start: "13:45", end: "14:30", type: PeriodType.REGULAR },
    ];

    for (const period of periods) {
      const startTime = new Date(`2025-01-06T${period.start}:00`);
      const endTime = new Date(`2025-01-06T${period.end}:00`);

      await prisma.entry.create({
        data: {
          timetableId: timetable.id,
          day: days,
          startTime,
          endTime,
          type: period.type,
          subjectId:
            period.type === PeriodType.REGULAR
              ? EXISTING.subjects.math1
              : undefined,
          teacherId:
            period.type === PeriodType.REGULAR
              ? EXISTING.staff.teacher
              : undefined,
        },
      });
    }
  }
  console.log(`  Created ${newTimetables.length} timetables with entries`);

  // ========================================
  // 9. CREATE ADDITIONAL INVOICES
  // ========================================
  console.log("\n🧾 Creating additional invoices...");

  const invoiceTemplates = [
    {
      title: "Second Term Fee",
      description: "School fees for second term 2025/2026",
      categories: ["schoolFees", "textbook"],
    },
    {
      title: "Sports Day",
      description: "Sports day event fee",
      categories: ["excursion"],
    },
    {
      title: "Third Term Fee",
      description: "School fees for third term 2025/2026",
      categories: ["schoolFees"],
    },
  ];

  const newInvoices: Invoice[] = [];
  for (let i = 0; i < invoiceTemplates.length; i++) {
    const template = invoiceTemplates[i];
    const invoiceNumber = generateInvoiceNumber(2025, i + 3);

    // Check if invoice exists
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber },
    });
    if (existing) continue;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        title: template.title,
        description: template.description,
        schoolId: EXISTING.schools.greenfieldAcademy,
        sessionId: EXISTING.sessions["2025/2026_greenfield"],
        createdBy: EXISTING.staff.admin,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        allowPartialPayment: true,
      },
    });

    // Create invoice items
    let totalAmount = 0;
    for (const categoryKey of template.categories) {
      const categoryId =
        EXISTING.feeCategories[
          categoryKey as keyof typeof EXISTING.feeCategories
        ];
      const amount =
        categoryKey === "schoolFees"
          ? 50000
          : categoryKey === "textbook"
            ? 15000
            : 5000;
      totalAmount += amount;

      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          feeCategoryId: categoryId,
          amount,
          description: `${template.title} - ${categoryKey}`,
        },
      });
    }

    // Assign to some students
    const studentsToAssign = allStudents.slice(0, 5);
    for (const student of studentsToAssign) {
      // Check if already assigned
      const existingAssignment = await prisma.studentInvoice.findUnique({
        where: {
          studentId_invoiceId: { studentId: student.id, invoiceId: invoice.id },
        },
      });
      if (existingAssignment) continue;

      await prisma.studentInvoice.create({
        data: {
          studentId: student.id,
          invoiceId: invoice.id,
          assignedBy: EXISTING.staff.admin,
          totalAmount,
          amountPaid: 0,
          amountDue: totalAmount,
          status: InvoiceStatus.UNPAID,
        },
      });
    }

    newInvoices.push(invoice);
  }
  console.log(
    `  Created ${newInvoices.length} new invoices with items and assignments`
  );

  // ========================================
  // 10. CREATE ADDITIONAL PAYMENTS
  // ========================================
  console.log("\n💵 Creating additional payments...");

  // Get student invoices
  const unpaidInvoices = await prisma.studentInvoice.findMany({
    where: {
      status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
    },
    take: 5,
  });

  let paymentCount = 7; // Starting from existing payment count
  for (const si of unpaidInvoices) {
    const paymentNumber = generatePaymentNumber(2025, paymentCount);

    // Check if payment exists
    const existing = await prisma.payment.findUnique({
      where: { paymentNumber },
    });
    if (existing) {
      paymentCount++;
      continue;
    }

    const paymentAmount = si.amountDue / 2; // Partial payment

    await prisma.payment.create({
      data: {
        paymentNumber,
        studentInvoiceId: si.id,
        amount: paymentAmount,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.COMPLETED,
        schoolId: EXISTING.schools.greenfieldAcademy,
        paidAt: new Date(),
        transactionRef: `TXN${Date.now()}${paymentCount}`,
      },
    });

    // Update student invoice
    await prisma.studentInvoice.update({
      where: { id: si.id },
      data: {
        amountPaid: { increment: paymentAmount },
        amountDue: { decrement: paymentAmount },
        status:
          si.amountDue - paymentAmount <= 0
            ? InvoiceStatus.PAID
            : InvoiceStatus.PARTIALLY_PAID,
      },
    });

    paymentCount++;
  }
  console.log(`  Created ${paymentCount - 7} new payments`);

  // ========================================
  // 11. CREATE PAYMENT GATEWAY
  // ========================================
  console.log("\n💳 Creating payment gateway...");

  const gateway = await prisma.paymentGateway.upsert({
    where: {
      schoolId_provider: {
        schoolId: EXISTING.schools.greenfieldAcademy,
        provider: "paystack",
      },
    },
    update: {},
    create: {
      schoolId: EXISTING.schools.greenfieldAcademy,
      provider: "paystack",
      publicKey: "pk_test_xxxxxxxxxxxxxxxxxxxxx",
      secretKey: "sk_test_xxxxxxxxxxxxxxxxxxxxx",
      webhookUrl: "https://api.example.com/webhooks/paystack",
      isActive: true,
      callbackUrl: "https://app.example.com/payment/callback",
    },
  });
  console.log(`  Created/verified payment gateway: ${gateway.provider}`);

  // ========================================
  // 12. CREATE ADDITIONAL NOTIFICATIONS
  // ========================================
  console.log("\n🔔 Creating additional notifications...");

  const notificationTemplates = [
    {
      title: "Welcome to New Term",
      message: "Welcome back! The new term has begun.",
      category: NotificationCategory.ACADEMIC,
    },
    {
      title: "Exam Schedule Released",
      message: "The exam schedule for this term has been released.",
      category: NotificationCategory.EXAM,
    },
    {
      title: "Fee Reminder",
      message: "This is a friendly reminder to complete your fee payment.",
      category: NotificationCategory.FEES,
    },
    {
      title: "Parent-Teacher Meeting",
      message: "Parent-teacher meeting scheduled for next week.",
      category: NotificationCategory.EVENTS,
    },
    {
      title: "Library Notice",
      message: "New books have arrived in the library.",
      category: NotificationCategory.LIBRARY,
    },
    {
      title: "Sports Day Announcement",
      message: "Annual sports day is coming up!",
      category: NotificationCategory.SPORTS,
    },
    {
      title: "Homework Assignment",
      message: "New homework assignments have been posted.",
      category: NotificationCategory.HOMEWORK,
    },
    {
      title: "Attendance Alert",
      message: "Please ensure regular attendance.",
      category: NotificationCategory.ATTENDANCE,
    },
  ];

  // Get all users
  const allUsers = await prisma.user.findMany({ take: 10 });

  const notifications: Prisma.NotificationCreateManyInput[] = [];
  for (const template of notificationTemplates) {
    for (const user of allUsers.slice(0, 3)) {
      notifications.push({
        userId: user.id,
        title: template.title,
        message: template.message,
        category: template.category,
        isRead: Math.random() > 0.5,
      });
    }
  }

  await prisma.notification.createMany({ data: notifications });
  console.log(`  Created ${notifications.length} notifications`);

  // ========================================
  // 13. CREATE ADDITIONAL EXPENSES
  // ========================================
  console.log("\n📋 Creating additional expenses...");

  const expenseData = [
    {
      title: "Staff Training Workshop",
      amount: 75000,
      category: ExpenseCategory.OTHER,
      description: "Professional development workshop for teachers",
    },
    {
      title: "Library Books Purchase",
      amount: 120000,
      category: ExpenseCategory.SUPPLIES,
      description: "New textbooks and reference materials",
    },
    {
      title: "Generator Fuel",
      amount: 35000,
      category: ExpenseCategory.UTILITIES,
      description: "Monthly fuel for backup generator",
    },
    {
      title: "Staff Monthly Salary",
      amount: 2500000,
      category: ExpenseCategory.SALARIES,
      description: "January 2025 staff salaries",
    },
    {
      title: "School Bus Maintenance",
      amount: 85000,
      category: ExpenseCategory.TRANSPORT,
      description: "Routine maintenance for school bus",
    },
    {
      title: "Computer Lab Equipment",
      amount: 450000,
      category: ExpenseCategory.SUPPLIES,
      description: "New computers for ICT lab",
    },
    {
      title: "Plumbing Repairs",
      amount: 28000,
      category: ExpenseCategory.MAINTENANCE,
      description: "Toilet and water pipe repairs",
    },
    {
      title: "Open Day Event",
      amount: 65000,
      category: ExpenseCategory.MARKETING,
      description: "Open day advertising and refreshments",
    },
  ];

  const newExpenses: Expense[] = [];
  for (let i = 0; i < expenseData.length; i++) {
    const ed = expenseData[i];
    const expenseDate = new Date();
    expenseDate.setDate(expenseDate.getDate() - i * 5);

    const expense = await prisma.expense.create({
      data: {
        title: ed.title,
        description: ed.description,
        amount: ed.amount,
        category: ed.category,
        schoolId: EXISTING.schools.greenfieldAcademy,
        createdBy: EXISTING.staff.accountant,
        expenseDate,
      },
    });
    newExpenses.push(expense);
  }
  console.log(`  Created ${newExpenses.length} expense records`);

  // ========================================
  // 14. CREATE PSYCHOMOTOR ASSESSMENTS
  // ========================================
  console.log("\n🎯 Creating psychomotor assessments...");

  const skills = Object.values(EXISTING.psychomotorSkills);
  const assessments: Prisma.StudentPsychomotorAssessmentCreateManyInput[] = [];

  if (activeTerm) {
    for (const student of allStudents.slice(0, 6)) {
      for (const skillId of skills) {
        // Check if assessment exists
        const existing = await prisma.studentPsychomotorAssessment.findUnique({
          where: {
            studentId_skillId_termId_sessionId: {
              studentId: student.id,
              skillId,
              termId: activeTerm.id,
              sessionId: EXISTING.sessions["2025/2026_greenfield"],
            },
          },
        });
        if (existing) continue;

        assessments.push({
          studentId: student.id,
          skillId,
          termId: activeTerm.id,
          sessionId: EXISTING.sessions["2025/2026_greenfield"],
          rating: Math.floor(Math.random() * 3) + 3, // Rating 3-5
          assessedById: EXISTING.staff.teacher,
        });
      }
    }

    if (assessments.length > 0) {
      await prisma.studentPsychomotorAssessment.createMany({
        data: assessments,
      });
    }
  }
  console.log(`  Created ${assessments.length} psychomotor assessments`);

  // ========================================
  // 15. CREATE EXAM ATTEMPTS & RESULTS
  // ========================================
  console.log("\n📝 Creating exam attempts and results...");

  // Get exam papers
  const examPapers = await prisma.examPaper.findMany({
    include: { questionBank: { include: { questions: true } } },
  });

  let attemptCount = 0;
  // Create results for all papers and all students
  for (const paper of examPapers) {
    for (const student of allStudents) {
      // Check if attempt exists
      const existingAttempt = await prisma.examAttempt.findUnique({
        where: {
          examPaperId_studentId: {
            examPaperId: paper.id,
            studentId: student.id,
          },
        },
      });
      if (existingAttempt) continue;

      // Randomize scores slightly
      const scoreBase = Math.floor(Math.random() * 40) + 60; // 60-100

      const startedAt = new Date();
      startedAt.setHours(startedAt.getHours() - 2);

      const attempt = await prisma.examAttempt.create({
        data: {
          examPaperId: paper.id,
          studentId: student.id,
          startedAt,
          submittedAt: new Date(),
          status: AttemptStatus.Graded,
          totalScore: scoreBase,
        },
      });

      // Create responses for each question
      if (paper.questionBank?.questions) {
        const questionsToAnswer = paper.questionBank.questions;
        for (const question of questionsToAnswer) {
          const isCorrect = Math.random() > 0.2; // 80% chance of being correct
          await prisma.examResponse.create({
            data: {
              attemptId: attempt.id,
              questionId: question.id,
              studentAnswer: isCorrect
                ? question.correctAnswer || { answer: "Correct Answer" }
                : { answer: "Wrong Answer" },
              isCorrect: isCorrect,
              marksAwarded: isCorrect ? question.marks : 0,
            },
          });
        }
      }

      // Create result
      const existingResult = await prisma.result.findUnique({
        where: {
          studentId_examPaperId: {
            studentId: student.id,
            examPaperId: paper.id,
          },
        },
      });
      if (!existingResult) {
        await prisma.result.create({
          data: {
            studentId: student.id,
            examPaperId: paper.id,
            marksObtained: attempt.totalScore || 0,
            isPublished: true,
            teacherRemark:
              (attempt.totalScore || 0) >= 70
                ? "Excellent work!"
                : (attempt.totalScore || 0) >= 50
                  ? "Good effort, keep improving."
                  : "Needs improvement.",
          },
        });
      }

      attemptCount++;
    }
  }
  console.log(
    `  Created ${attemptCount} exam attempts with responses and results`
  );

  // ========================================
  // 16. CREATE SCHEDULED MESSAGES
  // ========================================
  console.log("\n📨 Creating scheduled messages...");

  const superAdmin = await prisma.user.findFirst({
    where: { isSuperAdmin: true },
  });
  if (superAdmin) {
    const messages = [
      {
        title: "Term Start Reminder",
        message: "The new term starts next Monday. Please prepare accordingly.",
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Fee Payment Deadline",
        message:
          "Fee payment deadline is approaching. Please complete your payment.",
        scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Holiday Notice",
        message: "School will be closed for the upcoming public holiday.",
        scheduledAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const msg of messages) {
      await prisma.scheduled_Message.create({
        data: {
          userId: superAdmin.id,
          title: msg.title,
          message: msg.message,
          category: NotificationCategory.ANNOUNCEMENT,
          type: NotificationType.BOTH,
          scheduledAt: msg.scheduledAt,
          createdById: superAdmin.id,
        },
      });
    }
    console.log(`  Created ${messages.length} scheduled messages`);
  }

  // ========================================
  // DONE
  // ========================================
  console.log("\n✅ Database seeding completed successfully!");
  console.log("\n📊 Summary of new data created:");
  console.log(`  - Classes: ${newClasses.length}`);
  console.log(`  - Sections: ${newSections.length}`);
  console.log(`  - Subjects: ${newSubjects.length}`);
  console.log(`  - Parents: ${newParents.length}`);
  console.log(`  - Students: ${newStudents.length}`);
  console.log(`  - Staff: ${newStaff.length}`);
  console.log(`  - Question Banks: ${questionBanks.length}`);
  console.log(`  - Attendance Records: ${attendanceRecords.length}`);
  console.log(`  - Timetables: ${newTimetables.length}`);
  console.log(`  - Invoices: ${newInvoices.length}`);
  console.log(`  - Expenses: ${newExpenses.length}`);
  console.log(`  - Notifications: ${notifications.length}`);
  console.log(`  - Psychomotor Assessments: ${assessments.length}`);
  console.log(`  - Exam Attempts: ${attemptCount}`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
