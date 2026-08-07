'use client';
import { useEffect, useState } from 'react';
import { Users, MapPin, Landmark, Briefcase, GraduationCap, HeartHandshake } from 'lucide-react';
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

  return (
    // Sits flush below the hero. It used to be pulled up 24px, which read as a
    // deliberate ledge over the old flat hero but looks like a misalignment
    // over the carousel's full-bleed photography.
    <section className="max-w-tnr-wide mx-auto px-4 mt-10 mb-16 w-full" style={FONT}
      aria-label="Community statistics">
      <RevealGroup className="rounded-tnr-xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px overflow-hidden"
        style={{ background: 'rgba(255,255,255,.08)' }}>
        {CARDS.map(([key, label, Icon]) => (
          <RevealItem key={key}>
            <div className="h-full px-4 py-6 text-center"
              style={{ background: `linear-gradient(165deg,${COLORS.green900},${COLORS.green950})` }}>
              <Icon size={18} strokeWidth={2} aria-hidden="true"
                className="mx-auto mb-2" style={{ color: COLORS.gold400 }} />
              <div className="text-2xl sm:text-3xl font-extrabold" style={{ color: '#F3E4B3' }}>
                {c ? <CountUp value={c[key] ?? 0} /> : <span className="opacity-40">—</span>}
              </div>
              <div className="text-[11px] mt-1 leading-tight" style={{ color: 'rgba(255,255,255,.62)' }}>{label}</div>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
