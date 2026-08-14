'use client';
import ContactPage from '@/components/site/ContactPage';

// Thin wrapper. All four contact pages share one shell and one form; the only
// thing that differs is which kind of message they submit, and the wording for
// that lives in lib/contact.js.
export default function Page() {
  return <ContactPage kind="general" />;
}
