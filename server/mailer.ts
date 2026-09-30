import nodemailer from 'nodemailer';
import type { Log } from './schema.ts';

export interface Email {
    to: string;
    subject: string;
    text: string;
}

export interface Mailer {
    send(email: Email): Promise<void>;
}

/** Sends email through the SMTP server at `url`, from the address `from`. */
export function smtpMailer(url: string, from: string): Mailer {
    const transport = nodemailer.createTransport(url);

    return {
        send: async ({ to, subject, text }: Email) => {
            await transport.sendMail({ from, to, subject, text });
        }
    };
}

/** Writes email to the log instead of sending it, for development without SMTP. */
export const logMailer = (log: Log): Mailer => ({
    send: async (message) => log.info({ email: message }, 'Email not sent: SMTP_URL is not set')
});
