import { Resend } from 'resend';

export async function sendPasswordResetEmail(email: string, token: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  const { error } = await resend.emails.send({
    from: 'Behavioral Insights <onboarding@resend.dev>',
    to: email,
    subject: 'Reset your password',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 40px; height: 40px; background-color: #4f46e5; border-radius: 12px; margin-bottom: 16px;"></div>
            <h1 style="color: #0f172a; font-size: 24px; margin: 0;">Behavioral Insights</h1>
          </div>

          <div style="background-color: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #0f172a; font-size: 20px; margin-top: 0;">Reset your password</h2>
            <p>We received a request to reset your password. Click the button below to choose a new password:</p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 500;">Reset Password</a>
            </div>

            <p style="color: #64748b; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #94a3b8; font-size: 12px; word-break: break-all;">${resetUrl}</p>
          </div>

          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 32px;">
            Behavioral Insights - User behavior analytics
          </p>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error(`Email failed: ${error.message}`);
  }
}
