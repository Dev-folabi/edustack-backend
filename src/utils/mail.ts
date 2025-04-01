import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
// import Notification from '../models/notification.model';
// import SibApiV3Sdk from 'sib-api-v3-sdk';
import dotenv from "dotenv";
import prisma from '../prisma';

dotenv.config();



interface MailOptions {
  email: string;
  subject: string;
  message: string;
}

const sendMail = async (options: MailOptions): Promise<void> => {
  const transporter: Transporter = nodemailer.createTransport({
    host: process.env.SMPT_HOST as string,
    port: Number(process.env.SMPT_PORT),
    secure: false,
    service: process.env.SMPT_SERVICE as string,
    auth: {
      user: process.env.SMPT_MAIL as string,
      pass: process.env.SMPT_PASSWORD as string,
    },

  });

  const mailOptions: SendMailOptions = {
    from: process.env.SMPT_MAIL as string,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  await transporter.sendMail(mailOptions);
};

export default sendMail;

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
//     console.error("❌ Error sending email:", error);
//     throw new Error("Failed to send email");
//   }
// };


interface NotificationOptions {
  userId: string;
  title: string;
  message: string;
  category: 'ACADEMIC' | 'ATTENDANCE' | 'DISCIPLINE' | 'EXAM' | 'FEES' | 'HOMEWORK' | 'LIBRARY' | 'SPORTS' | 'EVENTS' | 'ANNOUNCEMENT';
}

export const createNotification = async (options: NotificationOptions): Promise<void> => {
  await prisma.notification.create({
    data: {
      userId: options.userId,
      title: options.title,
      message: options.message,
      category: options.category || 'ANNOUNCEMENT',
    }
  });
};
