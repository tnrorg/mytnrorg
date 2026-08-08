'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  GraduationCap, Briefcase, ScrollText, FolderGit2, ExternalLink,
  Languages as LanguagesIcon, HeartHandshake, Award,
} from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import ProfileHero from '@/components/council/ProfileHero';
import { Section, Timeline, TimelineItem, Tag, glass, yearRange } from '@/components/council/ProfileParts';
import { Skeleton, EmptyState } from '@/components/ui';
import { COLORS, FONT } from '@/lib/design/tokens';
import ViewTracker from '@/components/members/ViewTracker';

/* Full public profile for any member.
 *
 * Deliberately the SAME components the Advisory Council and Executive
 * Committee profiles use — ProfileHero, Section, Timeline, Tag. A general
 * member's page should not be a lesser thing than a council member's; the
 * difference is what they have filled in, not what the site is willing to
 * show. It also means one profile layout to maintain instead of two.
 */
export default function PublicMemberProfile() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let off = false;
    fetch(`/api/public/member-profile/${id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off) (j?.ok ? setD(j) : setErr(j?.message || 'Profile not found.')); })
      .catch(() => { if (!off) setErr('Profile not found.'); });
    return () => { off = true; };
  }, [id]);

  const p = d?.profile;
  const s = d?.sections || {};
  const has = (k) => !(s[k] || []).length;

  // Facts the hero does not already show.
  const details = !p ? [] : [
    ['Profession', p.profession],
    ['Current Position', p.current_position],
    ['Organisation / Institution', p.organisation],
    ['Highest Qualification', p.qualification],
    ['Field of Study', p.field],
    ['Village / Area', p.village],
    ['Union Council', p.union_council],
    ['Currently Living In', [p.current_city, p.current_state_province, p.country]
      .filter(Boolean).join(', ')],
    ['Membership Category', p.category],
    ['Membership ID', p.membership_id],
  ].filter(([, v]) => v);

  const links = !p ? [] : [
    ['LinkedIn', p.links?.linkedin], ['Portfolio', p.links?.portfolio], ['GitHub', p.links?.github],
  ].filter(([, v]) => v);

  return (
    <main id="main" className="light-page min-h-screen flex flex-col bg-tnr-snow"
      style={{ color: COLORS.charcoal, ...FONT }}>
      <SiteNav />
      {/* Records how long a reader stays. Renders nothing. */}
      {p?.membership_id && <ViewTracker membershipId={p.membership_id} />}

      {err && (
        <section className="max-w-tnr mx-auto px-5 py-20 w-full flex-1">
          <EmptyState icon="🔒" title={err}
            message="This member may not be listed publicly."
            action={<a href="/members" className="text-sm font-bold underline"
              style={{ color: COLORS.green700 }}>Back to Members</a>} />
        </section>
      )}

      {!d && !err && (
        <div className="flex-1">
          <div className="h-72" style={{ background: `linear-gradient(160deg,${COLORS.green950},${COLORS.green800})` }} />
          <div className="max-w-tnr mx-auto px-5 py-12 space-y-8">
            <Skeleton height="h-40" /><Skeleton lines={5} /><Skeleton height="h-56" />
          </div>
        </div>
      )}

      {p && (
        <>
          <ProfileHero p={p} />

          <div className="max-w-tnr mx-auto px-5 py-14 w-full space-y-14 flex-1">

            <Section id="about" title="About" empty={!p.bio && !p.intro}>
              <div className={`${glass} p-6`}>
                <p className="text-[15px] leading-[1.85] whitespace-pre-line" style={{ color: COLORS.muted }}>
                  {p.bio || p.intro}
                </p>
              </div>
            </Section>

            <Section id="details" title="Member Details" empty={!details.length}>
              <div className={`${glass} p-6`}>
                <dl className="grid sm:grid-cols-2 gap-x-8">
                  {details.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2.5 border-b"
                      style={{ borderColor: COLORS.neutral }}>
                      <dt className="text-[12.5px]" style={{ color: COLORS.muted }}>{k}</dt>
                      <dd className="text-[13.5px] font-semibold text-right" style={{ color: COLORS.charcoal }}>{v}</dd>
                    </div>
                  ))}
                </dl>
                {!!links.length && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {links.map(([label, url]) => (
                      <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-tnr border px-3.5 py-2 text-[12.5px] font-bold
                          transition-colors hover:bg-tnr-neutral"
                        style={{ borderColor: COLORS.neutral, color: COLORS.green700 }}>
                        {label}<ExternalLink size={12} aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            <Section id="education" title="Education" count={s.education?.length} empty={has('education')}>
              <div className={`${glass} p-6`}>
                <Timeline>
                  {(s.education || []).map(e => (
                    <TimelineItem key={e.id} heading={e.institution || e.degree}
                      sub={[e.degree, e.field_of_study].filter(Boolean).join(' · ')}
                      current={e.is_current}
                      meta={yearRange(e.start_year, e.end_year, e.is_current)}>
                      {e.grade && <span>Grade: {e.grade}</span>}
                      {e.description && <p className="mt-1">{e.description}</p>}
                    </TimelineItem>
                  ))}
                </Timeline>
              </div>
            </Section>

            <Section id="experience" title="Work Experience" count={s.experience?.length} empty={has('experience')}>
              <div className={`${glass} p-6`}>
                <Timeline>
                  {(s.experience || []).map(x => (
                    <TimelineItem key={x.id} heading={x.position || x.organisation}
                      sub={x.position ? x.organisation : null} current={x.is_current}
                      meta={yearRange(x.start_year, x.end_year, x.is_current)}>
                      {!!(x.responsibilities || []).length && (
                        <ul className="mt-1 space-y-1">
                          {x.responsibilities.map((r, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="mt-[7px] w-1 h-1 rounded-full shrink-0"
                                style={{ background: COLORS.gold500 }} />{r}
                            </li>
                          ))}
                        </ul>
                      )}
                      {x.contributions && <p className="mt-1.5">{x.contributions}</p>}
                    </TimelineItem>
                  ))}
                </Timeline>
              </div>
            </Section>

            <Section id="skills" title="Skills & Interests"
              empty={!(p.skills || []).length && !(p.expertise || []).length}>
              <div className="flex flex-wrap gap-2">
                {(p.skills || []).map((t, i) => <Tag key={`s-${t}`} i={i}>{t}</Tag>)}
                {(p.expertise || []).map((t, i) => <Tag key={`e-${t}`} i={i} tone="gold">{t}</Tag>)}
              </div>
            </Section>

            <Section id="certifications" title="Certifications" count={s.certifications?.length} empty={has('certifications')}>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(s.certifications || []).map(c => (
                  <div key={c.id} className={`${glass} p-5 transition-transform duration-standard hover:-translate-y-[3px]`}>
                    <ScrollText size={18} strokeWidth={2} aria-hidden="true" style={{ color: COLORS.gold500 }} />
                    <h3 className="mt-3 font-bold text-[14px] leading-snug" style={{ color: COLORS.charcoal }}>{c.title}</h3>
                    <div className="mt-1 text-[12.5px]" style={{ color: COLORS.muted }}>{c.issuer}</div>
                    {c.issue_date && <div className="mt-0.5 text-[12px]" style={{ color: COLORS.muted }}>
                      {new Date(c.issue_date).getFullYear()}</div>}
                    <div className="mt-3 flex gap-3 text-[12px] font-bold">
                      {c.file_url && <a href={c.file_url} target="_blank" rel="noopener noreferrer"
                        className="hover:underline" style={{ color: COLORS.green700 }}>View</a>}
                      {c.verify_url && <a href={c.verify_url} target="_blank" rel="noopener noreferrer"
                        className="hover:underline" style={{ color: COLORS.green700 }}>Verify</a>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="projects" title="Projects" count={s.projects?.length} empty={has('projects')}>
              <div className="grid sm:grid-cols-2 gap-4">
                {(s.projects || []).map(pr => (
                  <div key={pr.id} className={`${glass} overflow-hidden transition-transform duration-standard hover:-translate-y-[3px]`}>
                    {pr.image_url && <img src={pr.image_url} alt="" loading="lazy" className="w-full h-40 object-cover" />}
                    <div className="p-5">
                      <FolderGit2 size={16} strokeWidth={2} aria-hidden="true" style={{ color: COLORS.green700 }} />
                      <h3 className="mt-2.5 font-bold text-[14.5px]" style={{ color: COLORS.charcoal }}>{pr.title}</h3>
                      {pr.description && (
                        <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-line"
                          style={{ color: COLORS.muted }}>{pr.description}</p>
                      )}
                      {pr.url && (
                        <a href={pr.url} target="_blank" rel="noopener noreferrer"
                          className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-bold hover:underline"
                          style={{ color: COLORS.green700 }}>
                          Visit <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="volunteer" title="Volunteer Experience" count={s.volunteer?.length} empty={has('volunteer')}>
              <div className={`${glass} p-6`}>
                <Timeline>
                  {(s.volunteer || []).map(v => (
                    <TimelineItem key={v.id} heading={v.role || v.organisation}
                      sub={v.role ? v.organisation : null} current={v.is_current}
                      meta={yearRange(v.start_year, v.end_year, v.is_current)}>
                      {v.area && <div className="inline-flex items-center gap-1.5">
                        <HeartHandshake size={13} strokeWidth={2} aria-hidden="true"
                          style={{ color: COLORS.gold500 }} />{v.area}
                      </div>}
                      {v.description && <p className="mt-1">{v.description}</p>}
                    </TimelineItem>
                  ))}
                </Timeline>
              </div>
            </Section>

            <Section id="languages" title="Languages" count={s.languages?.length} empty={has('languages')}>
              <div className={`${glass} p-6`}>
                <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
                  {(s.languages || []).map(l => (
                    <li key={l.id} className="flex items-center justify-between gap-3 border-b pb-2"
                      style={{ borderColor: COLORS.neutral }}>
                      <span className="inline-flex items-center gap-2 text-[14px] font-semibold"
                        style={{ color: COLORS.charcoal }}>
                        <LanguagesIcon size={14} strokeWidth={2} aria-hidden="true"
                          style={{ color: COLORS.green700 }} />{l.language}
                      </span>
                      {l.proficiency && (
                        <span className="text-[12px]" style={{ color: COLORS.muted }}>{l.proficiency}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </Section>

            <Section id="tnr" title="Contribution to TNR"
              empty={!p.tnr_contributions && !p.awards_text}>
              <div className={`${glass} p-6 space-y-4`}>
                {p.tnr_contributions && (
                  <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: COLORS.charcoal }}>
                    {p.tnr_contributions}
                  </p>
                )}
                {p.awards_text && (
                  <div>
                    <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider"
                      style={{ color: COLORS.green700 }}>
                      <Award size={13} strokeWidth={2.2} aria-hidden="true" />Awards &amp; Achievements
                    </div>
                    <p className="mt-1.5 text-[14px] leading-relaxed whitespace-pre-line"
                      style={{ color: COLORS.muted }}>{p.awards_text}</p>
                  </div>
                )}
              </div>
            </Section>

            <div className="pt-4">
              <a href="/members" className="text-sm font-bold hover:underline" style={{ color: COLORS.green700 }}>
                ← Back to Members
              </a>
            </div>
          </div>
        </>
      )}

      <SiteFooter />
    </main>
  );
}
