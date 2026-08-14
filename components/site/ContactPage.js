'use client';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import ContactForm from '@/components/site/ContactForm';
import { KINDS, kindByKey } from '@/lib/contact';
import { COLORS, FONT } from '@/lib/design/tokens';
import { Mail, MapPin, MessageSquare } from 'lucide-react';

/* Shell shared by /contact and its three siblings.
 *
 * Deliberately NOT DocPage: that component ends every page with a "Source:
 * TNR Governance Handbook … the Constitution shall prevail" footer, which is
 * right for a governance document and odd under a form asking how we can help.
 *
 * The four pages differ only in their wording and the `kind` they submit —
 * everything below comes from lib/contact.js, so adding or renaming a form is
 * one edit in one file.
 */
export default function ContactPage({ kind }) {
  const meta = kindByKey(kind);
  const others = KINDS.filter(k => k.key !== meta.key);

  const hrefFor = (key) => (key === 'general' ? '/contact'
    : key === 'complaint' ? '/contact/complaints'
    : `/contact/${key}`);

  return (
    <div className="light-page min-h-screen bg-white" style={{ color: COLORS.charcoal, ...FONT }}>
      <SiteNav />

      <header className="relative overflow-hidden" style={{ background: '#063D2B' }}>
        <div aria-hidden="true" className="absolute inset-0 opacity-[.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }} />
        <div className="relative max-w-4xl mx-auto px-5 py-14 sm:py-20">
          <div className="text-[11px] font-bold uppercase tracking-[.28em] mb-3"
            style={{ color: COLORS.gold400 }}>
            {meta.label}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">{meta.heading}</h1>
          <p className="mt-4 text-white/80 text-base sm:text-lg max-w-2xl leading-relaxed">{meta.lead}</p>
        </div>
      </header>

      <main id="main" className="max-w-4xl mx-auto px-5 py-12 sm:py-16">
        <div className="grid lg:grid-cols-[minmax(0,1fr),260px] gap-10">
          <div className="min-w-0">
            <ContactForm kind={meta.key} />
          </div>

          <aside className="space-y-6">
            {/* Direct details, for anyone who would rather not use a form —
                and as a fallback if the form itself is what is broken. */}
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-[.14em] mb-3"
                style={{ color: COLORS.goldInk }}>Reach us directly</h2>
              <ul className="space-y-3 text-[13px] text-gray-600">
                <li className="flex gap-2.5">
                  <Mail size={15} className="mt-0.5 shrink-0" style={{ color: COLORS.green700 }} aria-hidden="true" />
                  <a href="mailto:tehreekenojawananroundu@gmail.com" className="hover:underline break-all">
                    tehreekenojawananroundu@gmail.com
                  </a>
                </li>
                <li className="flex gap-2.5">
                  <MapPin size={15} className="mt-0.5 shrink-0" style={{ color: COLORS.green700 }} aria-hidden="true" />
                  <span>Roundu, Gilgit-Baltistan, Pakistan</span>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-[11px] font-black uppercase tracking-[.14em] mb-3"
                style={{ color: COLORS.goldInk }}>Wrong form?</h2>
              <ul className="space-y-2">
                {others.map(k => (
                  <li key={k.key}>
                    <a href={hrefFor(k.key)}
                      className="group inline-flex items-start gap-2 text-[13px] text-gray-600 hover:text-gray-900">
                      <MessageSquare size={14} className="mt-0.5 shrink-0"
                        style={{ color: COLORS.green700 }} aria-hidden="true" />
                      <span className="group-hover:underline">{k.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Members with an account have a support channel inside the portal
                that already knows who they are — worth saying, since it saves
                them retyping their details. */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-[12px] text-gray-600 leading-relaxed">
              Already a member? <a href="/member/support" className="font-bold hover:underline"
                style={{ color: COLORS.green700 }}>Help &amp; Support</a> in your portal
              is linked to your membership, so you do not need to repeat your details.
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
