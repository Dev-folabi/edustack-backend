import cron from "node-cron";
import prisma from "../prisma";
import { notifyUser } from "../utils/notification";
import {
  transitionOngoingToCompleted,
  transitionScheduledToOngoing,
} from "../service/examStatusScheduler";
import logger from "../utils/logger";

/**
 * Asynchronously updates the status of academic terms based on the current date.
 * - Deactivates terms whose `end_date` has passed.
 * - Activates terms whose `start_date` has passed and `end_date` has not, and are currently inactive.
 * - Automatically creates new enrollments for all enrolled students when a term activates.
 * Logs the count of activated and deactivated terms.
 */
const updateTermStatuses = async () => {
  const currentDate = new Date();
  let deactivatedCount = 0;
  let activatedCount = 0;

  const deactivatedResult = await prisma.term.updateMany({
    where: {
      end_date: { lt: currentDate },
      isActive: true,
    },
    data: { isActive: false },
  });
  deactivatedCount = deactivatedResult.count;

  // Get terms that will be activated (before updating them)
  const termsToActivate = await prisma.term.findMany({
    where: {
      start_date: { lte: currentDate },
      end_date: { gte: currentDate },
      isActive: false,
    },
    select: { id: true, name: true, sessionId: true },
  });

  const activatedResult = await prisma.term.updateMany({
    where: {
      start_date: { lte: currentDate },
      end_date: { gte: currentDate },
      isActive: false,
    },
    data: { isActive: true },
  });
  activatedCount = activatedResult.count;

  // Transition students to newly activated terms
  if (termsToActivate.length > 0) {
    const { transitionStudentsToNewTerm } = await import(
      "../service/enrollmentService"
    );

    for (const term of termsToActivate) {
      logger.info(
        { termId: term.id, termName: term.name, sessionId: term.sessionId },
        "Transitioning students to newly activated term"
      );

      const result = await transitionStudentsToNewTerm(term.id);

      if (result.success) {
        logger.info(
          {
            termId: term.id,
            termName: term.name,
            transitioned: result.transitioned,
            skipped: result.skipped,
            errors: result.errors,
          },
          "Student transition completed for activated term"
        );
      } else {
        logger.error(
          { termId: term.id, termName: term.name, error: result.error },
          "Failed to transition students for activated term"
        );
      }
    }
  }

  if (deactivatedCount > 0 || activatedCount > 0) {
    logger.info(
      { deactivatedCount, activatedCount },
      "Term statuses updated by cron job."
    );
  } else {
    logger.info("No term statuses needed updating by cron job."); // More accurate message
  }
};

const updateOverdueInvoices = async () => {
  const currentDate = new Date();
  let updatedCount = 0;

  const result = await prisma.studentInvoice.updateMany({
    where: {
      status: {
        in: ["UNPAID"],
      },
      invoice: {
        dueDate: {
          lt: currentDate,
        },
      },
    },
    data: {
      status: "OVERDUE",
    },
  });

  updatedCount = result.count;

  if (updatedCount > 0) {
    logger.info(
      { updatedCount },
      "Overdue invoice statuses updated by cron job."
    );
  } else {
    logger.info("No overdue invoices to update.");
  }
};

/**
 * Cron job scheduled to run daily at midnight (server time).
 * Executes `updateTermStatuses` to manage the active status of academic terms.
 */
cron.schedule("0 0 * * *", () => {
  // Runs "At 00:00 (midnight) every day"
  logger.info("Running daily term status update cron job.");
  updateTermStatuses().catch((error) => {
    logger.error({ err: error }, "Error updating term statuses via cron job");
  });

  logger.info("Running daily overdue invoice update cron job.");
  updateOverdueInvoices().catch((error) => {
    logger.error(
      { err: error },
      "Error updating overdue invoices via cron job"
    );
  });
});

/**
 * Cron job scheduled to run every minute.
 * Processes scheduled messages from the `Scheduled_Message` table.
 * Fetches messages in batches, attempts to send them using `notifyUser`,
 * and updates their status to 'SENT' or 'FAILED'.
 */
import { autoSubmitCbtExams } from "../service/cbtService";
cron.schedule("* * * * *", async () => {
  // Runs "At every minute"
  logger.debug("Running scheduled message processing cron job.");
  await transitionScheduledToOngoing();
  await transitionOngoingToCompleted();
  await autoSubmitCbtExams();
  const batchSize = 50;
  let messagesProcessedInThisRun = 0;
  let moreMessages = true;

  while (moreMessages) {
    let messages;
    try {
      // Fetch a batch of scheduled messages that are due and not yet sent.
      messages = await prisma.scheduled_Message.findMany({
        where: { scheduledAt: { lte: new Date() }, status: "Scheduled" },
        take: batchSize,
      });
    } catch (dbError) {
      logger.error(
        { err: dbError },
        "Cron: Failed to fetch scheduled messages from DB."
      );
      moreMessages = false;
      break;
    }

    if (messages.length === 0) {
      moreMessages = false;
      break;
    }
    messagesProcessedInThisRun += messages.length;

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

        // If sending is successful, update the message status to 'SENT'.
        await prisma.scheduled_Message.update({
          where: { id: message.id },
          data: { status: "SENT", sentAt: new Date() },
        });
        logger.info(
          {
            messageId: message.id,
            userId: message.userId,
            email: message.email,
          },
          "Sent scheduled message successfully."
        );
      } catch (error) {
        logger.error(
          { err: error, messageId: message.id, userId: message.userId },
          "Failed to send scheduled message."
        );
        // If sending failed, update the message status to 'FAILED'.
        try {
          await prisma.scheduled_Message.update({
            where: { id: message.id },
            data: { status: "FAILED" },
          });
        } catch (updateError) {
          logger.error(
            { err: updateError, messageId: message.id },
            "Failed to mark scheduled message as FAILED after send error."
          );
        }
      }
    }
    // If the batch fetched was smaller than batchSize, it means no more messages are pending in this run.
    if (messages.length < batchSize) {
      moreMessages = false;
    }
  } // End of while(moreMessages)

  if (messagesProcessedInThisRun > 0) {
    logger.info(
      { count: messagesProcessedInThisRun },
      "Scheduled message processing cron job cycle finished."
    );
  } else {
    logger.debug("No scheduled messages to process in this cron cycle.");
  }
});
