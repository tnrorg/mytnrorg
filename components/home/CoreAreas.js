'use client';
import {
  GraduationCap, Users, Briefcase, HeartHandshake, MonitorSmartphone,
  Stethoscope, Trophy, Sparkles, Globe2, ArrowRight,
} from 'lucide-react';
import { RevealGroup, RevealItem, SectionHeading } from '@/components/ui';
import { FONT } from '@/lib/design/tokens';

// The nine core areas from the brief. Links point only at routes that exist;
// areas without a page yet route to the membership form, where interest in
// each area is captured as a contribution area.
const AREAS = [
  ['Education & Scholarships', 'Guidance, scholarships and learning support for students.', GraduationCap, '/membership/apply'],
  ['Youth Development',        'Building confidence, skills and civic responsibility.',      Users,         '/membership/apply'],
  ['Career & Skills',          'Jobs, internships, mentorship and skills training.',         Briefcase,     '/member/opportunities'],
  ['Community Welfare',        'Relief, support and welfare rooted in our villages.',        HeartHandshake, '/volunteer'],
  ['Digital Services',         'Bringing digital access and literacy to Roundu.',            MonitorSmartphone, '/membership/apply'],
  ['Health Awareness',         'Campaigns and awareness on community health.',               Stethoscope,   '/membership/apply'],
  ['Sports & Culture',         'Celebrating the talent and heritage of Roundu.',             Trophy,        '/membership/apply'],
  ['Women Empowerment',        'Creating space, voice and opportunity for women.',           Sparkles,      '/membership/apply'],
  ['Overseas Coordination',    'Connecting our community beyond the valley.',                Globe2,        '/membership/apply'],
];

export default function CoreAreas() {
  return (
    <section className="max-w-tnr-wide mx-auto px-4 pb-16 w-full" style={FONT}>
      <SectionHeading align="center" eyebrow="What We Do" title="Our Core Areas"
        lead="Nine areas where TNR members contribute their time, skills and expertise." />

      <RevealGroup className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" gap={0.05}>
        {AREAS.map(([title, desc, Icon, href]) => (
          <RevealItem key={title} className="h-full">
            {/* Colours are Tailwind classes, not inline styles. An inline style
                always beats a hover class, so the previous version could not
                have a hover state at all — every colour here has to be a class
                for `group-hover` to reach it. */}
            <a href={href}
              className="tnr-glass tnr-sheen tnr-lift
                group h-full flex flex-col rounded-tnr-lg p-6
                transition-colors duration-standard
                hover:bg-[#0F5138] hover:border-[#0F5138]">
              <span className="w-11 h-11 rounded-tnr grid place-items-center transition-colors duration-standard
                bg-[rgba(23,107,73,.09)] text-[#176B49]
                group-hover:bg-white/15 group-hover:text-[#F8FAF8]">
                {/* lucide strokes with currentColor, so the icon follows the
                    span's text colour without needing its own hover rule. */}
                <Icon size={20} strokeWidth={2} aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-bold text-[15px] transition-colors duration-standard
                text-[#0A3D2C] group-hover:text-[#F8FAF8]">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed flex-1 transition-colors duration-standard
                text-[#647169] group-hover:text-white/80">{desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold
                transition-colors duration-standard text-[#176B49] group-hover:text-[#F8FAF8]">
                Get involved
                <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true"
                  className="transition-transform duration-micro group-hover:translate-x-0.5" />
              </span>
            </a>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
