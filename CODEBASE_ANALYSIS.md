# Codebase Analysis: School Management System

## 1. Introduction and Main Purpose

The application is a comprehensive **School Management System (SMS)** or **Student Information System (SIS)**. It is designed to manage and streamline various aspects of school operations, academic structures, the complete student lifecycle, user roles and permissions, and internal communications within one or more educational institutions.

## 2. Project Structure and Key Technologies

*   **Overall Architecture:** The project follows a typical Node.js web service architecture with a RESTful API.
    *   **Entry Point:** `src/index.ts` likely initializes the server and middleware.
    *   **Routing:** API routes are defined in `src/routes/api.ts`, which then delegates to feature-specific route modules located in subdirectories under `src/routes/` (e.g., `src/routes/authRoutes/index.ts`).
    *   **Controllers:** Business logic is handled by controllers found in `src/controllers/` (e.g., `authController.ts`, `studentController.ts`).
    *   **Database Interaction:** `prisma/schema.prisma` defines the database schema and models.
    *   **Middleware:** Custom middleware for validation (`src/middlewares/Validators.ts`, `src/middlewares/customValidations.ts`) and authorization (`src/middlewares/authorization.ts`) is used extensively.
*   **Main Programming Language:** TypeScript.
*   **Framework:** Express.js (Node.js web application framework).
*   **Database:** PostgreSQL (as specified in `prisma/schema.prisma`).
*   **ORM:** Prisma (handles database interaction, schema definition, migrations, and provides a type-safe client).
*   **Key Dependencies (from `package.json`):**
    *   `express`: For building the web server and handling HTTP requests/routes.
    *   `prisma` & `@prisma/client`: For database operations.
    *   `typescript`: For static typing and modern JavaScript features.
    *   `ts-node`: To run TypeScript code directly in Node.js during development.
    *   `dotenv`: For managing environment variables.
    *   `http-status-codes`: Provides constants for HTTP status codes.
    *   `cors`: To enable Cross-Origin Resource Sharing.
    *   `helmet`: To enhance security by setting various HTTP headers.
    *   `morgan`: For HTTP request logging.
    *   `nodemon`: For automatic server restarts during development.

## 3. Core Functionalities and Features

The application provides a rich set of features essential for school management:

*   **User Authentication & Authorization:**
    *   Handles registration for different user types: Super Admins, Staff (teachers, school admins, etc.), and Students.
    *   Secure user sign-in and password management (OTP verification, password reset).
    *   Role-based access control is implemented, restricting access to certain functionalities based on user roles (e.g., `admin`, `super_admin`, `teacher`).
    *   Managed by `src/routes/authRoutes/index.ts` and `src/controllers/authController.ts`.

*   **School Administration:**
    *   Allows `admin` users to create, update, delete, and manage profiles for multiple schools.
    *   Users can be associated with specific schools through the `UserSchool` link, defining their role within that institution.
    *   Managed by `src/routes/schoolRoutes/index.ts` and `src/controllers/schoolController.ts`.

*   **Academic Structure Management:**
    *   **Sessions & Terms:** `super_admin` users can define and manage academic `Session`s (e.g., "2023-2024") and the `Term`s within them (e.g., "Term 1").
    *   **Classes & Sections:** Schools can define `Classes` (grade levels, e.g., "Grade 10") and further divide them into `Class_Section`s (e.g., "Grade 10 A").
    *   Class teachers can be assigned to sections.
    *   Managed by `src/routes/sessionRoutes/index.ts`, `src/routes/classRoutes/index.ts`, and their corresponding controllers.

*   **Student Lifecycle Management:**
    *   Handles student admission (via student signup) and maintains detailed student profiles.
    *   `StudentEnrollment`: Manages the enrollment of students into specific classes and sections for active academic sessions/terms, tracking their status (e.g., `enrolled`, `promoted`, `graduated`).
    *   `PromotionHistory`: Records student promotions from one class to another.
    *   `StudentTransfer`: Facilitates and tracks the transfer of students between schools, including their new class and section.
    *   Manages `Parent` information and links parents to their respective students.
    *   Managed by `src/routes/studentRoutes/index.ts` and `src/controllers/studentController.ts`.

*   **Staff Management:**
    *   Staff registration and profile management (personal details, designation, qualifications).
    *   Assignment of roles and responsibilities within schools, including class teacher assignments.
    *   Primarily initiated via auth routes, with staff-specific data stored in the `Staff` model.

*   **Communication & Notifications:**
    *   **Notifications:** Provides a system for sending real-time, in-app `Notification`s to users (students, staff, parents).
    *   **Scheduled Messages:** Allows `admin` users to compose and send/schedule bulk messages (`Scheduled_Message`) via email or in-app notifications, categorized by topics like academics, events, or fees.
    *   Managed by `src/routes/notificationRoutes/index.ts` and `src/controllers/notificationController.ts`.

## 4. Database Schema Overview (`prisma/schema.prisma`)

The application employs a relational database schema, meticulously defined using Prisma, to organize its data.

*   **Key Enums:**
    *   `Gender`: (`male`, `female`, `others`) for `Student` and `Staff`.
    *   `EnrollStatus`: (`enrolled`, `promoted`, etc.) for `StudentEnrollment`.
    *   `UserRole`: (`student`, `admin`, `teacher`, etc.) for `UserSchool` associations.
    *   `NotificationCategory`: (`GENERAL`, `ACADEMIC`, etc.) for `Notification` and `Scheduled_Message`.
    *   `NotificationType`: (`EMAIL`, `IN_APP`, `BOTH`) for `Scheduled_Message`.
    *   `MessageStatus`: (`Scheduled`, `SENT`, `FAILED`) for `Scheduled_Message`.

*   **Core Data Models:**
    *   **`School`**: Represents an educational institution.
    *   **`User`**: The central model for all individuals, acting as a base for more specific roles. Contains authentication details.
    *   **`UserSchool`**: A crucial join table linking `User`s to `School`s with a specific `UserRole`, enabling multi-school affiliations and role-based access within each school.
    *   **`Student`**: Stores detailed student information, linked one-to-one with a `User` account and many-to-one with a `Parent`.
    *   **`Staff`**: Contains information about staff members, linked one-to-one with a `User` account. Can be designated as a `class_teacher`.
    *   **`Parent`**: Stores parent/guardian details, linked one-to-one with a `User` account and one-to-many with `Student`s.
    *   **`Session`**: Defines academic years or sessions.
    *   **`Term`**: Represents terms or semesters within a `Session`.
    *   **`Classes`**: Defines academic grade levels (e.g., "Grade 1," "Form 2") within a `School`.
    *   **`Class_Section`**: Represents specific sections or divisions of a `Classes` (e.g., "Grade 1 A").
    *   **`StudentEnrollment`**: A key transactional model that records a student's enrollment in a particular `Class_Section`, `Session`, and `Term`, along with their `EnrollStatus`.
    *   **`PromotionHistory`**: Logs the progression of students from one `Classes` to another.
    *   **`StudentTransfer`**: Manages the details of students transferring between `School`s.
    *   **`Notification`**: Stores individual, targeted notifications for users.
    *   **`Scheduled_Message`**: Manages messages created by admins for bulk or scheduled delivery.

*   **Key Relationships:**
    *   The schema heavily relies on one-to-many and many-to-many (via join tables like `UserSchool`) relationships.
    *   Foreign keys enforce data integrity between related models (e.g., `Student.userId` references `User.id`; `StudentEnrollment` links to `Student`, `Classes`, `Class_Section`, `Session`, and `Term`).
    *   Prisma's relation annotations (e.g., `@relation`) clearly define these connections and their behavior (e.g., `onDelete: Cascade`).

## 5. Deeper Dive into the Database Schema (`prisma/schema.prisma`)

This section provides a more granular look at the database schema details.

*   **Common Field Attributes & Data Types:**
    *   **Primary Keys (`@id`)**: Most models use a `String` field named `id` as the primary key, with `@default(cuid())`.
    *   **Timestamps**: `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` are standard.
    *   **Default Boolean Flags**: `isActive Boolean @default(true)` (e.g., in `School`, `Student`), `isSuperAdmin Boolean @default(false)` (`User`), `isRead Boolean @default(false)` (`Notification`).
    *   **Optional Fields (`?`)**: Numerous fields are optional (e.g., `User.email String?`, `Student.phone String?`).
    *   **Arrays**: `String[]` is used for `School.phone` and `Staff.phone`.

*   **Unique Constraints:**
    *   **Single Field (`@unique`)**: `School.name`, `User.email`, `User.username`, `Student.userId`, `Student.admission_number`, `Staff.userId`, `Parent.userId`, `Session.label`.
    *   **Multi-Field (`@@unique`)**:
        *   `UserSchool`: `@@unique([userId, schoolId])`
        *   `Term`: `@@unique([label, sessionId])`
        *   `Classes`: `@@unique([label, schoolId])`
        *   `Class_Section`: `@@unique([classId, label])`

*   **Relational Integrity (Cascade Behaviors):**
    *   **`UserSchool`**:
        *   `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`: Deleting a `User` cascades to `UserSchool` records.
        *   `school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)`: Deleting a `School` cascades to `UserSchool` records.
    *   Other relations generally do not specify explicit cascade delete behavior, implying Prisma's default (often `RESTRICT` or `NO ACTION` depending on database and specific relation constraints).

*   **Attribute Annotations & Specific Field Details:**
    *   `@map("class_id")` in `Class_Section.classId`: Maps the Prisma field `classId` to the database column `class_id`.
    *   `Student.admission_number Int? @unique @default(autoincrement())`: The only auto-incrementing integer, likely for human-readable student IDs.

*   **How Specific Models Enable Key Functionalities:**
    *   **`UserSchool` for Role-Based Access & Multi-School Support**:
        *   This model is pivotal. It links a generic `User` to a specific `School` and assigns a `UserRole` (e.g., `admin`, `teacher`). This structure allows a single user to hold different roles in different schools. The `@@unique([userId, schoolId])` constraint is critical for ensuring a user has only one defined role per school. Cascade deletes simplify user/school removal.
    *   **`StudentEnrollment` for Comprehensive Academic Tracking**:
        *   This model acts as a ledger for a student's academic journey. It connects a `Student` to a `Classes`, `Class_Section`, `Session`, and (optionally) `Term`. The `status EnrollStatus` field (e.g., `enrolled`, `promoted`, `pending`) is crucial for understanding the student's current standing in that specific context. This design allows for a rich history of a student's enrollments over time.
    *   **`PromotionHistory` & `StudentTransfer` for Academic Progression**:
        *   `PromotionHistory` creates an auditable record of a student moving from a `fromClassId` to a `toClassId` within a given `sessionId` and `termId`.
        *   `StudentTransfer` details the movement of students between schools, including the destination class and section.
    *   **`Staff` and `Class_Section` for Teacher Assignments**:
        *   The optional `teacherId` foreign key in `Class_Section` links to a `Staff` record, formally assigning a class teacher to a section. This supports a one-to-many relationship (one teacher can teach multiple sections).
    *   **`Notification` and `Scheduled_Message` for Communication**:
        *   `Notification` is for direct, individual user alerts with a `isRead` status.
        *   `Scheduled_Message` supports broader communication, initiated by a `createdById` (User), with `type` (Email, In-App) and `status` (Scheduled, Sent, Failed) tracking. The `userId` field in `Scheduled_Message` likely indicates the direct recipient if it's not a bulk message.

*   **Indexing:**
    *   While no explicit `@@index` attributes are defined, Prisma automatically creates indexes for fields with `@id` and `@unique`. Composite indexes are created for `@@unique` constraints. Foreign key fields also generally receive indexes, optimizing join performance. For most common query patterns, these implicit indexes are sufficient.

This detailed schema structure effectively underpins the application's complex requirements for managing a school environment, from user roles and academic progression to communication.
