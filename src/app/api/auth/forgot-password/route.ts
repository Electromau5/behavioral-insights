import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Delete any existing tokens for this user
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

    // Generate a secure token
    const token = nanoid(48);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store the token
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // Send the email
    await sendPasswordResetEmail(email, token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
