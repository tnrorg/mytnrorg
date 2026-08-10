'use client';
import { motion } from 'framer-motion';
import { MapPin, Building2, Mail, Phone, FileDown, MessageSquarePlus } from 'lucide-react';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { FemaleIcon, NeutralIcon } from '@/components/ui/Avatar';
import { genderIconKind } from '@/lib/membership/options';
import { academicTitle } from '@/lib/membership/options';
import { COLORS, FONT, MOTION } from '@/lib/design/tokens';
import { initials } from '@/content/advisoryCouncil';

export default function ProfileHero({ p, onRequestGuidance }) {
  const meta = [
    p.organisation && [Building2, p.organisation],
    p.country && [MapPin, p.country],
  ].filter(Boolean);

  return (
    <header className="relative overflow-hidden" style={FONT}>
      <div aria-hidden="true" className="absolute inset-0"
        style={{ background: `linear-gradient(160deg,${COLORS.green950},${COLORS.green800})` }} />
      <div aria-hidden="true" className="absolute -top-32 -right-24 w-96 h-96 rounded-full"
        style={{ background: 'radial-gradient(circle,rgba(200,154,43,.18),transparent 68%)' }} />

      <div className="relative max-w-tnr mx-auto px-5 py-12 sm:py-16
        grid sm:grid-cols-[176px,minmax(0,1fr)] gap-8 items-start">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: MOTION.reveal, ease: MOTION.ease }}
          className="w-36 sm:w-44 aspect-[4/5] rounded-tnr-lg overflow-hidden mx-auto sm:mx-0"
          style={{ border: '2px solid rgba(200,154,43,.45)' }}>
          {p.photo_url
            ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover object-top" />
            : <div role="img" aria-label={p.name}
                className="w-full h-full grid place-items-center text-white"
                style={{ background: `linear-gradient(140deg,${COLORS.green700},${COLORS.green950})` }}>
                {/* A member who has chosen not to publish a photograph gets the
                    silhouette, not their initials — initials still single them
                    out as "the one without a picture". Blank gender keeps the
                    initials it has always shown; only an explicit choice draws
                    an icon. */}
                {genderIconKind(p.gender) === 'female'
                  ? <FemaleIcon className="w-1/2 h-1/2" title={p.name} />
                  : (genderIconKind(p.gender) === 'neutral' && p.gender)
                  ? <NeutralIcon className="w-1/2 h-1/2" title={p.name} />
                  : <span aria-hidden="true" className="text-4xl font-extrabold">{initials(p.name || '')}</span>}
              </div>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.reveal, delay: 0.08, ease: MOTION.ease }}>
          {p.designation && (
            <div className="text-[11px] font-bold uppercase tracking-[.18em]" style={{ color: COLORS.gold400 }}>
              {p.designation}
            </div>
          )}
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex flex-wrap items-center gap-2.5">
            {p.name}
            {/* Published profiles are admin-approved, so the badge is unconditional.
                Height is set in `em`, so it inherits the heading's font size and
                the pill matches the name's line box at every breakpoint —
                fixed padding left it noticeably short beside a 36px name. */}
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 h-[1.1em] shrink-0
              text-[11px] font-bold leading-none"
              style={{ background: 'rgba(200,154,43,.18)', color: COLORS.gold400 }}>
              <VerifiedBadge size={14} fill={COLORS.gold400} decorative />Verified
            </span>
          </h1>

          {(p.profession || academicTitle(p.qualification, p.field)) && (
            <p className="mt-1.5 text-[15px] font-semibold" style={{ color: 'rgba(255,255,255,.86)' }}>
              {[p.profession, academicTitle(p.qualification, p.field)].filter(Boolean).join(' · ')}
            </p>
          )}
          {p.tagline && (
            <p className="mt-3 max-w-2xl text-[14px] italic leading-relaxed" style={{ color: 'rgba(255,255,255,.66)' }}>
              “{p.tagline}”
            </p>
          )}

          {!!meta.length && (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px]" style={{ color: 'rgba(255,255,255,.7)' }}>
              {meta.map(([Icon, text]) => (
                <span key={text} className="inline-flex items-center gap-1.5">
                  <Icon size={14} strokeWidth={2} aria-hidden="true" />{text}
                </span>
              ))}
            </div>
          )}

          {/* Contact appears only when the member has published it. When a
              field is off it is absent entirely — no "hidden" placeholder. */}
          {(p.email || p.mobile) && (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
              {p.email && (
                <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 hover:underline"
                  style={{ color: COLORS.gold400 }}>
                  <Mail size={14} strokeWidth={2} aria-hidden="true" />{p.email}
                </a>
              )}
              {p.mobile && (
                <a href={`tel:${p.mobile}`} className="inline-flex items-center gap-1.5 hover:underline"
                  style={{ color: COLORS.gold400 }}>
                  <Phone size={14} strokeWidth={2} aria-hidden="true" />{p.mobile}
                </a>
              )}
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            {p.accepts_guidance && (
              <button onClick={onRequestGuidance}
                className="group inline-flex items-center gap-2 rounded-tnr px-5 py-3 text-sm font-bold
                  transition-transform duration-micro hover:-translate-y-[2px]"
                style={{ background: `linear-gradient(180deg,${COLORS.gold400},${COLORS.gold500})`, color: COLORS.green950 }}>
                <MessageSquarePlus size={16} strokeWidth={2.3} aria-hidden="true" />
                Request Guidance
              </button>
            )}
            {p.cv_url && (
              <a href={p.cv_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-tnr px-5 py-3 text-sm font-bold text-white
                  border transition-colors duration-micro hover:bg-white/10"
                style={{ borderColor: 'rgba(255,255,255,.28)' }}>
                <FileDown size={16} strokeWidth={2.2} aria-hidden="true" />
                View CV
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </header>
  );
}
