import cron from "node-cron";
import prisma from "../prisma";
import { notifyUser } from "../utils/notification";
import logger from "../utils/logger";

/**
 * Asynchronously updates the status of academic terms based on the current date.
 * - Deactivates terms whose `end_date` has passed.
 * - Activates terms whose `start_date` has passed and `end_date` has not, and are currently inactive.
 * Logs the count of activated and deactivated terms.
 */
const updateTermStatuses = async () => {
  const currentDate = new Date();
  let deactivatedCount = 0;
  let activatedCount = 0;

  // Deactivate terms that have ended:
  // Finds terms that are currently active but their end_date is in the past.
  const deactivatedResult = await prisma.term.updateMany({
    where: {
      end_date: { lt: currentDate }, // Less than current date
      isActive: true,
    },
    data: { isActive: false },
  });
  deactivatedCount = deactivatedResult.count;

  // Activate terms that have started and not yet ended:
  // Finds terms that are currently inactive, their start_date is in the past or present,
  // and their end_date is in the present or future.
  const activatedResult = await prisma.term.updateMany({
    where: {
      start_date: { lte: currentDate }, // Less than or equal to current date
      end_date: { gte: currentDate },   // Greater than or equal to current date
      isActive: false,
    },
    data: { isActive: true },
  });
  activatedCount = activatedResult.count;

  if (deactivatedCount > 0 || activatedCount > 0) {
    logger.info({ deactivatedCount, activatedCount }, "Term statuses updated by cron job.");
  } else {
    logger.info("No term statuses needed updating by cron job."); // More accurate message
  }
};

/**
 * Cron job scheduled to run daily at midnight (server time).
 * Executes `updateTermStatuses` to manage the active status of academic terms.
 */
cron.schedule("0 0 * * *", () => { // Runs "At 00:00 (midnight) every day"
  logger.info("Running daily term status update cron job.");
  updateTermStatuses().catch((error) => {
    logger.error({ err: error }, "Error updating term statuses via cron job");
  });
});

/**
 * Cron job scheduled to run every minute.
 * Processes scheduled messages from the `Scheduled_Message` table.
 * Fetches messages in batches, attempts to send them using `notifyUser`,
 * and updates their status to 'SENT' or 'FAILED'.
 */
cron.schedule("* * * * *", async () => { // Runs "At every minute"
  logger.debug("Running scheduled message processing cron job.");
  const batchSize = 50; // Number of messages to process in each iteration.
  let messagesProcessedInThisRun = 0;
  let moreMessages = true; // Flag to continue fetching batches if the last batch was full.

  while(moreMessages) {
    let messages;
    try {
        // Fetch a batch of scheduled messages that are due and not yet sent.
        messages = await prisma.scheduled_Message.findMany({
        where: { scheduledAt: { lte: new Date() }, status: "Scheduled" },
        take: batchSize,
        });
    } catch (dbError) {
        logger.error({err: dbError}, "Cron: Failed to fetch scheduled messages from DB.");
        moreMessages = false; // Stop processing this cycle if DB fetch fails.
        break;
    }

    // If no messages are found in the current batch, exit the loop for this cron run.
    if (messages.length === 0) {
      moreMessages = false;
      break;
    }
    messagesProcessedInThisRun += messages.length;

    for (const message of messages) {
      try {
        // Attempt to send the notification using the utility function.
        await notifyUser({
          userId: message.userId,
          email: message.email! || "", // Ensure email is not null, or handle if it can be.
          title: message.title,
          message: message.message,
          category: message.category,
          channels: [message.type], // notifyUser expects an array of NotificationType.
        });

        // If sending is successful, update the message status to 'SENT'.
        await prisma.scheduled_Message.update({
          where: { id: message.id },
          data: { status: "SENT", sentAt: new Date() },
        });
        logger.info({ messageId: message.id, userId: message.userId, email: message.email }, "Sent scheduled message successfully.");
      } catch (error) {
        logger.error({ err: error, messageId: message.id, userId: message.userId }, "Failed to send scheduled message.");
        // If sending failed, update the message status to 'FAILED'.
        try {
            await prisma.scheduled_Message.update({
                where: { id: message.id },
                data: { status: "FAILED" },
            });
        } catch (updateError) {
            logger.error({ err: updateError, messageId: message.id }, "Failed to mark scheduled message as FAILED after send error.");
        }
      }
    }
    // If the batch fetched was smaller than batchSize, it means no more messages are pending in this run.
    if (messages.length < batchSize) {
        moreMessages = false;
    }
  } // End of while(moreMessages)

  if (messagesProcessedInThisRun > 0) {
    logger.info({ count: messagesProcessedInThisRun }, "Scheduled message processing cron job cycle finished.");
  } else {
    logger.debug("No scheduled messages to process in this cron cycle.");
  }
});
