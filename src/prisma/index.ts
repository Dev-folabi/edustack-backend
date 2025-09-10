import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  transactionOptions: {
    timeout: 10000,
    maxWait: 5000,
  },
});

export default prisma;
