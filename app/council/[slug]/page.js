'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  GraduationCap, Briefcase, BookOpen, Award, FolderGit2, Images,
  ScrollText, ExternalLink, FileDown, Microscope, ClipboardList,
  Languages as LanguagesIcon, HeartHandshake,
} from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import ProfileHero from '@/components/council/ProfileHero';
import GuidanceDialog from '@/components/council/GuidanceDialog';
import { Section, Timeline, TimelineItem, Tag, glass, yearRange } from '@/components/council/ProfileParts';
import { Skeleton, EmptyState } from '@/components/ui';
import { COLORS, FONT } from '@/lib/design/tokens';

export default function CouncilProfilePage() {
  const { slug } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    fetch(`/api/public/council/${slug}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => (j?.ok ? setD(j) : setErr(j?.message || 'Profile not found.')))
      .catch(() => setErr('Profile not found.'));
  }, [slug]);

  const p = d?.profile;
  const s = d?.sections || {};
  const has = (k) => !(s[k] || []).length;

  // Everything factual the member entered, minus what the hero already shows
  // as headline text. Blank fields drop out rather than printing an empty row.
  const details = !p ? [] : [
    ['Current Profession', p.profession],
    ['Organisation / University', p.organisation],
    ['Country', p.country],
    ['Highest Qualification', p.qualification],
    ['Field of Study', p.field],
    ['Affiliation', p.affiliation],
    ['Role in TNR', p.designation],
  ].filter(([, v]) => v);

  return (
    <main id="main" className="light-page min-h-screen flex flex-col bg-tnr-snow"
      style={{ color: COLORS.charcoal, ...FONT }}>
      <SiteNav />

      {err && (
        <section className="max-w-tnr mx-auto px-5 py-20 w-full flex-1">
          <EmptyState icon="🔒" title={err}
            message="This profile may not be published yet."
            action={<a href="/about/advisory-council" className="text-sm font-bold underline"
              style={{ color: COLORS.green700 }}>Back to Leadership</a>} />
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
          <ProfileHero p={p} onRequestGuidance={() => setAsk(true)} />

          <div className="max-w-tnr mx-auto px-5 py-14 w-full space-y-14 flex-1">

            {/* Every field the member filled in their portal appears here.
                `intro` is the short card line and `bio` the long piece — they
                used to collapse into one another, so whichever the member had
                not written simply vanished from their public page. */}
            <Section id="about" title="About" empty={!p.bio && !p.summary && !p.intro}>
              <div className={`${glass} p-6 space-y-4`}>
                {p.intro && (
                  <p className="text-[16px] font-semibold leading-[1.7] whitespace-pre-line"
                    style={{ color: COLORS.charcoal }}>{p.intro}</p>
                )}
                {p.bio && (
                  <p className="text-[15px] leading-[1.85] whitespace-pre-line" style={{ color: COLORS.muted }}>
                    {p.bio}
                  </p>
                )}
                {/* Only shown when it adds something the bio does not. */}
                {p.summary && p.summary !== p.bio && p.summary !== p.intro && (
                  <p className="text-[15px] leading-[1.85] whitespace-pre-line" style={{ color: COLORS.muted }}>
                    {p.summary}
                  </p>
                )}
              </div>
            </Section>

            <Section id="details" title="Professional Details" empty={!details.length}>
              <div className={`${glass} p-6`}>
                <dl className="grid sm:grid-cols-2 gap-x-8">
                  {details.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2.5 border-b"
                      style={{ borderColor: COLORS.neutral }}>
                      <dt className="text-[12.5px] shrink-0" style={{ color: COLORS.muted }}>{k}</dt>
                      <dd className="text-[13.5px] font-semibold text-right" style={{ color: COLORS.charcoal }}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Section>

            <Section id="education" title="Education Journey" count={s.education?.length} empty={has('education')}>
              <div className={`${glass} p-6`}>
                <Timeline>
                  {(s.education || []).map(e => (
                    <TimelineItem key={e.id} heading={e.institution}
                      sub={[e.degree, e.field_of_study].filter(Boolean).join(' · ')}
                      current={e.is_current}
                      meta={yearRange(e.start_year, e.end_year, e.is_current)}>
                      {[e.country, e.grade && `Grade: ${e.grade}`].filter(Boolean).join(' · ')}
                      {e.description && <p className="mt-1">{e.description}</p>}
                    </TimelineItem>
                  ))}
                </Timeline>
              </div>
            </Section>

            <Section id="experience" title="Professional Experience" count={s.experience?.length} empty={has('experience')}>
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

            <Section id="publications" title="Research & Publications" count={s.publications?.length} empty={has('publications')}>
              <ul className="space-y-3">
                {(s.publications || []).map(r => (
                  <li key={r.id} className={`${glass} p-5`}>
                    <div className="flex items-start gap-3">
                      <BookOpen size={17} strokeWidth={2} aria-hidden="true"
                        className="mt-0.5 shrink-0" style={{ color: COLORS.green700 }} />
                      <div className="min-w-0">
                        <h3 className="font-bold text-[14.5px] leading-snug" style={{ color: COLORS.charcoal }}>{r.title}</h3>
                        <div className="mt-1 text-[12.5px]" style={{ color: COLORS.muted }}>
                          {[r.authors, r.venue, r.year].filter(Boolean).join(' · ')}
                        </div>
                        {r.abstract && <p className="mt-2 text-[13px] leading-relaxed" style={{ color: COLORS.muted }}>{r.abstract}</p>}
                        <div className="mt-2.5 flex flex-wrap gap-3 text-[12px] font-semibold">
                          <span className="rounded-full px-2 py-0.5"
                            style={{ background: COLORS.neutral, color: COLORS.muted }}>{r.kind}</span>
                          {r.doi && <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline" style={{ color: COLORS.green700 }}>
                            DOI <ExternalLink size={11} aria-hidden="true" /></a>}
                          {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline" style={{ color: COLORS.green700 }}>
                            Link <ExternalLink size={11} aria-hidden="true" /></a>}
                          {r.pdf_url && <a href={r.pdf_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline" style={{ color: COLORS.green700 }}>
                            PDF <FileDown size={11} aria-hidden="true" /></a>}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
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
                    {c.credential_id && <div className="mt-2 text-[11px] font-mono" style={{ color: COLORS.muted }}>
                      ID: {c.credential_id}</div>}
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

            <Section id="awards" title="Awards & Achievements" count={s.awards?.length} empty={has('awards')}>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(s.awards || []).map(a => (
                  <div key={a.id} className={`${glass} overflow-hidden transition-transform duration-standard hover:-translate-y-[3px]`}>
                    {a.image_url && <img src={a.image_url} alt="" loading="lazy" className="w-full h-36 object-cover" />}
                    <div className="p-5">
                      <Award size={18} strokeWidth={2} aria-hidden="true" style={{ color: COLORS.gold500 }} />
                      <h3 className="mt-2.5 font-bold text-[14px] leading-snug" style={{ color: COLORS.charcoal }}>{a.title}</h3>
                      <div className="mt-1 text-[12.5px]" style={{ color: COLORS.muted }}>
                        {[a.organisation, a.year].filter(Boolean).join(' · ')}
                      </div>
                      {a.description && <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: COLORS.muted }}>{a.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="skills" title="Professional Skills"
              empty={!(p.skills || []).length && !(p.expertise || []).length}>
              <div className="flex flex-wrap gap-2">
                {/* Prefixed keys: a skill and an expertise tag can legitimately
                    share a word, and now that CV skills merge in they often do. */}
                {(p.skills || []).map((t, i) => <Tag key={`s-${t}`} i={i}>{t}</Tag>)}
                {(p.expertise || []).map((t, i) => <Tag key={`e-${t}`} i={i} tone="gold">{t}</Tag>)}
              </div>
            </Section>

            <Section id="research" title="Research Areas" empty={!(p.research_areas || []).length}>
              <div className={`${glass} p-6`}>
                <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
                  {(p.research_areas || []).map(r => (
                    <li key={r} className="flex gap-2.5 text-[14px]" style={{ color: COLORS.charcoal }}>
                      <Microscope size={15} strokeWidth={2} aria-hidden="true"
                        className="mt-0.5 shrink-0" style={{ color: COLORS.green700 }} />{r}
                    </li>
                  ))}
                </ul>
              </div>
            </Section>

            <Section id="duties" title="Role & Responsibilities" empty={!(p.duties || []).length}>
              <div className={`${glass} p-6`}>
                <ul className="space-y-2.5">
                  {(p.duties || []).map(t => (
                    <li key={t} className="flex gap-2.5 text-[14px] leading-relaxed" style={{ color: COLORS.charcoal }}>
                      <ClipboardList size={15} strokeWidth={2} aria-hidden="true"
                        className="mt-1 shrink-0" style={{ color: COLORS.gold500 }} />{t}
                    </li>
                  ))}
                </ul>
              </div>
            </Section>

            <Section id="projects" title="Projects & Community Contributions" count={s.projects?.length} empty={has('projects')}>
              <div className="grid sm:grid-cols-2 gap-4">
                {(s.projects || []).map(pr => (
                  <div key={pr.id} className={`${glass} overflow-hidden transition-transform duration-standard hover:-translate-y-[3px]`}>
                    {pr.image_url && <img src={pr.image_url} alt="" loading="lazy" className="w-full h-40 object-cover" />}
                    <div className="p-5">
                      <div className="flex items-center gap-2">
                        <FolderGit2 size={16} strokeWidth={2} aria-hidden="true" style={{ color: COLORS.green700 }} />
                        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                          style={{ background: COLORS.neutral, color: COLORS.muted }}>{pr.kind}</span>
                      </div>
                      <h3 className="mt-2.5 font-bold text-[14.5px]" style={{ color: COLORS.charcoal }}>{pr.title}</h3>
                      <div className="mt-0.5 text-[12px]" style={{ color: COLORS.muted }}>
                        {yearRange(pr.start_year, pr.end_year)}
                      </div>
                      {pr.description && <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-line" style={{ color: COLORS.muted }}>{pr.description}</p>}
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

            <Section id="gallery" title="Gallery" count={s.gallery?.length} empty={has('gallery')}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {(s.gallery || []).map(g => (
                  <figure key={g.id} className="rounded-tnr overflow-hidden bg-gray-100 group">
                    <img src={g.image_url} alt={g.caption || ''} loading="lazy"
                      className="w-full aspect-[4/3] object-cover transition-transform duration-standard group-hover:scale-[1.03]" />
                    {g.caption && <figcaption className="px-3 py-2 text-[11.5px]" style={{ color: COLORS.muted }}>{g.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </Section>

            <div className="pt-4">
              <a href={p.body === 'executive' ? '/about/executive-committee' : '/about/advisory-council'}
                className="text-sm font-bold hover:underline" style={{ color: COLORS.green700 }}>
                ← Back to {p.body === 'executive' ? 'the Executive Committee' : 'the Advisory Council'}
              </a>
            </div>
          </div>

          <GuidanceDialog open={ask} onClose={() => setAsk(false)} slug={slug} memberName={p.name} />
        </>
      )}

      <SiteFooter />
    </main>
  );
}
