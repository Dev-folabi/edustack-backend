# EduStack: Next-Gen School Management Platform (Auth & ERP Backend)

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

**EduStack** is a high-performance, multi-tenant ERP designed to power modern educational institutions. Developed with a focus on scalability, security, and developer experience, it provides a robust backend for managing the entire academic and administrative lifecycle of multiple schools within a single ecosystem.

---

## 🚀 Key Modules & Robust Features

### 🔐 1. Multi-Tenant Identity & Access Management (IAM)

- **Hierarchical RBAC**: Granular Role-Based Access Control for SuperAdmins, School Admins, Staff, Students, and Parents.
- **School Isolation**: Strict data segregation ensuring school-level privacy in a multi-tenant environment.
- **Secure Authentication**: JWT-based stateless authentication with bcrypt hashing and session management via Redis.
- **Onboarding Orchestration**: Automated multi-step onboarding flow for new institutions.

### 📚 2. Academic Lifecycle Engine

- **Dynamic Sessions & Terms**: Manage academic calendars, term-specific settings, and automated transitions.
- **Class & Section Management**: Hierarchical organization of students with class-teacher assignments.
- **Smart Promotion System**: Rules-based student promotion history tracking across sessions.
- **Comprehensive Student/Staff Profiles**: 360-degree view of all stakeholders with document management.

### 📝 3. Advanced Examination & CBT System

- **CBT Interface**: Full-fledged Computer Based Test (CBT) backend supporting various question types (MCQs, Theory).
- **Question Banking**: Centralized repository for questions categorised by subject, difficulty, and complexity.
- **Automated Grading**: Instant result generation for objective tests with manual grade scaling for theory.
- **Psychomotor Assessment**: Built-in support for tracking behavioral and physical skill development.

### 💳 4. Financial & Accounting Ledger

- **Automated Invoicing**: Generation of student-specific invoices based on customizable fee categories.
- **Payment Gateway Integration**: Seamless integration with modern payment providers (Paystack, Flutterwave, etc.).
- **Expense Tracking**: Comprehensive ledger for tracking school expenditures with receipt uploads.
- **Partial Payment Logic**: Support for flexible payment plans and debt tracking.

### 🕒 5. Utility & Communication Services

- **Attendance Tracking**: Advanced attendance logs for both students and staff with subject-level granularity.
- **Dynamic Timetable**: Algorithmic timetable generation for classes and exams.
- **Messaging System**: Scheduled and instant notifications via Email and SMS (queued via Redis).
- **System Auditing**: Comprehensive logging of critical system events and security audits.

---

## 🛠️ Technical Sophistication (Tech Stack)

| Category             | Technology          | Purpose                                                     |
| :------------------- | :------------------ | :---------------------------------------------------------- |
| **Runtime**          | Node.js (v18+)      | High-performance asynchronous execution.                    |
| **Language**         | TypeScript          | Type-safety, better IDE support, and maintainable codebase. |
| **Framework**        | Express             | Lightweight and flexible routing middleware.                |
| **ORM/DB**           | Prisma + PostgreSQL | Type-safe database queries and scalable relational storage. |
| **Caching/Queue**    | Redis               | Session state management and background task scheduling.    |
| **Validation**       | Express-Validator   | Schema-based request validation and sanitization.           |
| **Containerization** | Docker              | Consistent environment across development and production.   |
| **Logging**          | Pino                | Structured, high-speed logging.                             |

---

## 🏗️ Architecture & Design Patterns

- **Microservices Ready**: Designed as a standalone auth/core service that can easily integrate into a larger microservice architecture.
- **Middleware-First Design**: Heavily utilizes custom middlewares for authentication, multi-tenancy context, and error handling.
- **Prisma Middleware**: Extended Prisma client for automated auditing and tenant filtering.
- **Unit of Work**: Leverages Prisma transactions for atomic operations across complex financial and academic workflows.

---

## 🚦 Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js (v18+)
- PostgreSQL (if running locally without Docker)

### Installation

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/your-username/edustack-auth-microservice.git
    cd edustack-auth-microservice
    ```

2.  **Environment Setup**:

    ```bash
    cp .env.example .env
    # Update your DATABASE_URL and other secrets in .env
    ```

3.  **Run with Docker (Recommended)**:

    ```bash
    docker-compose up --build
    ```

4.  **Local Development**:
    ```bash
    npm install
    npx prisma generate
    npx prisma migrate dev
    npm run dev
    ```

---

## 🧪 API Documentation

The project includes a comprehensive Postman collection for testing and integration.

- [Postman Collection](file:///home/afolabi/Desktop/EDUSTACK_DEV/edustack-auth-microservice/EDU STACK RESTful API.postman_collection.json)

---

## 👤 Author

**Yusuf Afolabi – Backend Engineer**