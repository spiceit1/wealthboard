import { NextResponse } from 'next/server';
import { getAuthorizedUserId } from '@/lib/owner-auth';
import { dispatchBankSync } from '@/lib/bank-sync';

export async function POST() {
  const userId = await getAuthorizedUserId();
  if (!userId) return NextResponse.json({ message: 'Sign in required.' }, { status: 401 });
  try {
    await dispatchBankSync({ URL: process.env.URL, APP_URL: process.env.APP_URL, INTERNAL_SYNC_TOKEN: process.env.INTERNAL_SYNC_TOKEN }, fetch, true);
    return NextResponse.json({ queued: true }, { status: 202 });
  } catch {
    return NextResponse.json({ message: 'Unable to start the investment import. Please try again.' }, { status: 503 });
  }
}
