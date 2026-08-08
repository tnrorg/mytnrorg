'use client';
import { useEffect, useState } from 'react';
import { Users, MapPin, Landmark, Briefcase, GraduationCap, HeartHandshake, Eye } from 'lucide-react';
import { RevealGroup, RevealItem } from '@/components/ui';
import CountUp from '@/components/ui/CountUp';
import { COLORS, FONT } from '@/lib/design/tokens';

// Live community figures. The previous version of this bar shipped invented
// numbers ("10K+ Registered Members", "25+ Countries"); everything here is
// read from the membership database instead, and shows a dash until it loads.
const CARDS = [
  ['members',       'Active Members',      Users],
  ['areas',         'Villages / Areas',    MapPin],
  ['unionCouncils', 'Union Councils',      Landmark],
  ['professionals', 'Professionals',       Briefcase],
  ['students',      'Students',            GraduationCap],
  ['qualified',     'Skilled Contributors', HeartHandshake],
  ['visits',        'Website Visitors',    Eye],
];

export default function CommunityStats() {
  const [c, setC] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/public/community-stats', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => j?.ok && j.community ? setC(j.community) : setFailed(true))
      .catch(() => setFailed(true));
  }, []);

  // If the figures cannot be read, show nothing rather than a row of zeros
  // that would misrepresent the organisation.
  if (failed) return null;

  // The visitor tile only appears once the counter table exists — the API
  // returns null for it otherwise, and publishing "0 Website Visitors" on a
  // site that plainly has some would be worse than omitting the figure.
  const cards = CARDS.filter(([key]) => key !== 'visits' || (c && c.visits != null));

  return (
    // Sits flush below the hero. It used to be pulled up 24px, which read as a
    // deliberate ledge over the old flat hero but looks like a misalignment
    // over the carousel's full-bleed photography.
    <section className="max-w-tnr-wide mx-auto px-4 mt-10 mb-16 w-full" style={FONT}
      aria-label="Community statistics">
      {/* One dark slab carrying a gold hairline, with the cells divided by 1px
          gaps rather than borders — borders on a 6-up grid double up at every
          seam and read as a heavier line on the inner edges than the outer. */}
      {/* Keyed on the tile count for the same reason as the leadership grid:
          the visitor tile appears only after the stats request resolves, and a
          RevealGroup that already fired would leave the late tile invisible. */}
      <RevealGroup key={cards.length}
        className={`tnr-ring-gold rounded-tnr-xl grid grid-cols-2 sm:grid-cols-3 gap-px overflow-hidden
          ${cards.length === 7 ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}
        style={{
          background: 'rgba(255,255,255,.08)',
          boxShadow: '0 2px 4px rgba(6,45,33,.06), 0 22px 50px -14px rgba(6,45,33,.35)',
        }}>
        {cards.map(([key, label, Icon]) => (
          <RevealItem key={key}>
            <div className="group relative h-full px-4 py-7 text-center overflow-hidden transition-colors duration-500"
              style={{ background: `linear-gradient(165deg,${COLORS.green900},${COLORS.green950})` }}>
              {/* Gold wash that fades in under the cursor. Sits behind the
                  content and is inert, so it cannot swallow a tap. */}
              <div aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: 'radial-gradient(70% 60% at 50% 0%, rgba(200,154,43,.20), transparent 70%)' }} />
              <div className="relative">
                <Icon size={19} strokeWidth={2} aria-hidden="true"
                  className="mx-auto mb-2.5 transition-transform duration-500 group-hover:-translate-y-0.5"
                  style={{ color: COLORS.gold400 }} />
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: '#F3E4B3' }}>
                  {c ? <CountUp value={c[key] ?? 0} /> : <span className="opacity-40">—</span>}
                </div>
                <div className="text-[11px] mt-1.5 leading-tight tracking-wide"
                  style={{ color: 'rgba(255,255,255,.66)' }}>{label}</div>
              </div>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
