import cron from "node-cron";
import prisma from "../prisma";
import { notifyUser } from "../utils/notification";

// Function to update term statuses
const updateTermStatuses = async () => {
  const currentDate = new Date();

  // Deactivate terms that have ended
  await prisma.term.updateMany({
    where: {
      end_date: {
        lt: currentDate,
      },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  // Activate terms that have started
  await prisma.term.updateMany({
    where: {
      start_date: {
        lte: currentDate,
      },
      end_date: {
        gte: currentDate,
      },
      isActive: false,
    },
    data: {
      isActive: true,
    },
  });
};

// Schedule the job to run every day at midnight
cron.schedule("0 0 * * *", () => {
  console.log("Running term status update job");
  updateTermStatuses().catch((error) => {
    console.error("Error updating term statuses:", error);
  });
});

cron.schedule("* * * * *", async () => {

  const batchSize = 50; // Process 50 messages at a time
  let messages;

  do {
    messages = await prisma.scheduled_Message.findMany({
      where: { scheduledAt: { lte: new Date() }, status: "Scheduled" },
      take: batchSize,
    });

    for (const message of messages) {
      try {
        await notifyUser({
          userId: message.userId,
          email: message.email! || "",
          title: message.title,
          message: message.message,
          category: message.category,
          channels: [message.type],
        });

        await prisma.scheduled_Message.update({
          where: { id: message.id },
          data: { status: "SENT" },
        });

        console.log(`Sent scheduled message to ${message.email}`);
      } catch (error) {
        console.error(
          `Failed to send scheduled message to ${message.email}:`,
          error
        );
      }
    }
  } while (messages.length === batchSize);
});
