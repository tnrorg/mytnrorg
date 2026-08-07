// EMAIL-ONLY OTP delivery for the TNR voting system.
// Phone / SMS / WhatsApp delivery has been permanently disabled — voters
// authenticate solely through their registered email address.
export async function deliverOtp({ email, code }) {
  const provider = (process.env.OTP_PROVIDER || 'email').toLowerCase();

  // 'dev' keeps on-screen codes for local testing only (no external send).
  if (provider === 'dev') {
    const e = new Error('OTP_PROVIDER=dev (no external delivery configured)');
    e.dev = true; throw e;
  }

  // Every other value delivers by email. There is no phone path.
  const { sendEmailOtp } = await import('./emailOtp');
  if (!email) throw new Error('No email address on file for this member.');
  await sendEmailOtp(email, code);
  return { channel: 'email' };
}
