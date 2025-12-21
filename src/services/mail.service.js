import { Resend } from "resend";
let resendInstance;
const getResend = () => {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing RESEND_API_KEY. Set it in your environment (.env)"
      );
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
};

export const sendResumeEmail = async ({ to, subject, html }) => {
  const resend = getResend();
  const data = await resend.emails.send({
    from: "AI Resume Builder <no-reply@airesumebuilder.com>",
    to,
    subject,
    html,
  });
  return data;
};
