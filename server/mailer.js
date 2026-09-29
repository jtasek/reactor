import nodemailer from 'nodemailer';

/** Sends email through the SMTP server at `url`, from the address `from`. */
export function smtpMailer(url, from) {
    const transport = nodemailer.createTransport(url);

    return {
        send: async ({ to, subject, text }) => {
            await transport.sendMail({ from, to, subject, text });
        }
    };
}

/** Writes email to the log instead of sending it, for development without SMTP. */
export const logMailer = (log) => ({
    send: async (message) => log.info({ email: message }, 'Email not sent: SMTP_URL is not set')
});
