// import Notification from '../models/notification.model';
// import SibApiV3Sdk from 'sib-api-v3-sdk';
import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import dotenv from "dotenv";
import prisma from "../prisma";

dotenv.config();

interface MailOptions {
  email: string;
  subject: string;
  message: string;
}

const sendMail = async (options: MailOptions, attempt = 1): Promise<void> => {
    try {
      const transporter: Transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST as string,
        port: Number(process.env.SMTP_PORT),
        secure: false,
        service: process.env.SMTP_SERVICE as string,
        auth: {
          user: process.env.SMTP_MAIL as string,
          pass: process.env.SMTP_PASSWORD as string,
        },
      });

      const mailOptions: SendMailOptions = {
        from: process.env.SMTP_MAIL as string,
        to: options.email,
        subject: options.subject,
        text: options.message,
      };

      await transporter.sendMail(mailOptions);
      console.log(` Email sent successfully to ${options.email}`);
    } catch (error: any) {
      console.error(` Error sending email to ${options.email}:`, error.message);

      if (attempt < 3) {
        console.log(`Retrying email (${attempt + 1}/3)...`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 sec before retry
        await sendMail(options, attempt + 1);
      } else {
        console.error(`Failed to send email after 3 attempts: ${options.email}`);
      }
    }
  };


export interface NotificationOptions {
  userId: string;
  title: string;
  message: string;
  category:
    | "GENERAL"
    | "ACADEMIC"
    | "ATTENDANCE"
    | "DISCIPLINE"
    | "EXAM"
    | "FEES"
    | "HOMEWORK"
    | "LIBRARY"
    | "SPORTS"
    | "EVENTS"
    | "ANNOUNCEMENT";
}

const createNotification = async (
  options: NotificationOptions
): Promise<void> => {
  try {
    await prisma.notification.create({
      data: {
        userId: options.userId,
        title: options.title,
        message: options.message,
        category: options.category ?? "GENERAL",
      },
    });
  } catch (error) {
    console.error("Error creating in-app notification:", error);
  }
};

export const notifyUser = async ({
  userId,
  email,
  title,
  message,
  category = "GENERAL",
  channels = ["IN_APP", "EMAIL"],
}: {
  userId: string;
  email: string;
  title: string;
  message: string;
  category?: NotificationOptions["category"];
  channels: ("EMAIL" | "IN_APP" | "BOTH")[];
}) => {
  console.log(email);
  if (channels.includes("IN_APP") || channels.includes("BOTH")) {
    await createNotification({ userId, title, message, category });
  }

  if (channels.includes("EMAIL") || channels.includes("BOTH")) {
    await sendMail({ email, subject: title, message });
  }
};

// interface MailOptions {
//   email: string;
//   subject: string;
//   htmlContent?: string;
//   message: string;
// }

// const brevoClient = SibApiV3Sdk.ApiClient.instance;
// const apiKey = brevoClient.authentications["api-key"];
// apiKey.apiKey = process.env.BREVO_API_KEY || "";

// const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

// export const sendMail = async ({
//   email,
//   subject,
//   message,
//   htmlContent,
// }: MailOptions) => {
//   try {
//     const emailData = {
//       sender: {
//         email: process.env.BREVO_SENDER_EMAIL,
//         name: process.env.BREVO_SENDER_NAME
//       },
//       to: [{ email }],
//       subject,
//       htmlContent,
//       textContent: message,
//     };

//     const response = await emailApi.sendTransacEmail (emailData);
//     console.log("✅ Brevo API Response:", JSON.stringify(response, null, 2));
//     return response;
//   } catch (error) {
//     console.error(" Error sending email:", error);
//     throw new Error("Failed to send email");
//   }
// };
