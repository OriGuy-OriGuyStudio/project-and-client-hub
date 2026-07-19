// Admin , printable project spec ("אפיון הפרויקט"): the discovery call plus
// the published personas / customer journey / sitemap, laid out as a clean
// light-background document meant to be printed or saved as PDF from the
// browser (no PDF library: the browser's own engine is the only thing that
// renders Hebrew RTL correctly, and it's what AgreementConfirmation already
// does). Two audiences via ?mode= :
//   client (default) , internal design_notes stripped, safe to send onward
//   full                , everything, for Ori and for feeding an AI tool
// The stripping itself lives in lib/project-spec.ts and is unit-tested there.

import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Copy, Download, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast, toastError } from "@/hooks/use-toast";
import { useProject } from "@/hooks/useProject";
import {
  usePublishedPersonas,
  usePublishedJourney,
  usePublishedSitemap,
  useProjectDiscoveryItems,
} from "@/hooks/useDeliverables";
import {
  specToMarkdown,
  specIsEmpty,
  personaLines,
  journeyStageLines,
  sitemapTopPageLines,
  type SpecAudience,
  type SpecInput,
} from "@/lib/project-spec";
import type { PersonaContent, JourneyContent, SitemapContent } from "@/types/database";

export default function ProjectSpecExport() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const audience: SpecAudience = params.get("mode") === "full" ? "full" : "client";

  const { data: bundle } = useProject(id);
  const project = bundle?.project;
  const brand = bundle?.brand;
  const { data: personaRows } = usePublishedPersonas(id);
  const { data: journeyRow } = usePublishedJourney(id);
  const { data: sitemapRow } = usePublishedSitemap(id);
  const { data: disc } = useProjectDiscoveryItems(id);
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  /** Server-side PDF: headless Chromium renders the document with our own page
   *  box, margins and footer. The browser's print dialog clipped the RTL text
   *  at the page edge and stamped its own header/URL onto every page, which is
   *  why this does not just call window.print(). */
  async function downloadPdf() {
    setPdfBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("no session");
      const res = await fetch(`/api/spec-pdf?project=${encodeURIComponent(id)}&mode=${audience}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`pdf ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `אפיון-${project?.title || "פרויקט"}${audience === "full" ? "-פנימי" : ""}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toastError("יצירת ה-PDF נכשלה. נסה שוב.");
    } finally {
      setPdfBusy(false);
    }
  }

  const input: SpecInput = useMemo(
    () => ({
      projectTitle: project?.title ?? "",
      businessName: brand?.business_name ?? null,
      discoveryTitle: disc?.found ? disc.title : null,
      discovery: disc?.found ? disc.items : [],
      personas: (personaRows ?? []).map((d) => d.content as unknown as PersonaContent),
      journey: (journeyRow?.content as unknown as JourneyContent) ?? null,
      sitemap: (sitemapRow?.content as unknown as SitemapContent) ?? null,
      generatedAt: new Date(),
    }),
    [project, brand, disc, personaRows, journeyRow, sitemapRow],
  );

  const empty = specIsEmpty(input);
  const answered = (input.discovery ?? []).filter((d) => (d.answer ?? "").trim());

  async function copyForAi() {
    try {
      await navigator.clipboard.writeText(specToMarkdown(input, audience));
      setCopied(true);
      toast({ title: "הועתק. אפשר להדביק בכלי ה-AI.", variant: "success" });
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toastError("ההעתקה נכשלה. נסה שוב, או השתמש בהדפסה.");
    }
  }

  return (
    // Standalone page (routed outside AppShell): the document is the whole
    // screen, so nothing from the app frame can bleed into the printout.
    <div className="min-h-screen bg-background p-4 sm:p-6 print:bg-white print:p-0">
      {/* Toolbar , never printed. */}
      <div className="mx-auto mb-5 flex max-w-3xl flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-8">
            <Link to={`/projects/${id}`} aria-label="חזרה לפרויקט">
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <div>
            <p className="font-heading text-lg font-semibold text-foreground">
              אפיון הפרויקט {audience === "full" ? "(גרסה מלאה)" : "(גרסה ללקוח)"}
            </p>
            <p className="text-xs text-muted-foreground">
              {audience === "full"
                ? "כולל את ההערות הפנימיות. לא לשליחה ללקוח."
                : "בלי הערות פנימיות. אפשר לשלוח ללקוח."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/admin/projects/${id}/spec?mode=${audience === "full" ? "client" : "full"}`}>
              {audience === "full" ? "לגרסה ללקוח" : "לגרסה המלאה"}
            </Link>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void copyForAi()} disabled={empty}>
            <Copy className="size-4" />
            {copied ? "הועתק ✓" : "העתק ל-AI"}
          </Button>
          <Button size="sm" onClick={() => void downloadPdf()} disabled={empty || pdfBusy}>
            {pdfBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {pdfBusy ? "מכין PDF…" : "הורדת PDF"}
          </Button>
        </div>
      </div>

      {empty ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground print:hidden">
          אין עדיין תוכן אפיון לפרויקט הזה. פרסם פרסונות, מסע לקוח או מפת אתר, או שייך שיחת אפיון.
        </p>
      ) : (
        // The document itself: forced light so the PDF is printable and
        // readable, independent of the admin's dark theme.
        <article className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-[#14131a] shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
          <header className="border-b-2 border-[#B4D670] pb-4">
            <p className="text-xs font-semibold tracking-wide text-[#6b6a75]">סטודיו אורי גיא</p>
            <h1 className="mt-1 font-heading text-3xl font-black">
              אפיון הפרויקט: {input.projectTitle || "ללא שם"}
            </h1>
            <p className="mt-1.5 text-sm text-[#4b4a55]">
              {input.businessName ? `${input.businessName} · ` : ""}
              נוצר ב-{input.generatedAt.toLocaleDateString("he-IL")}
            </p>
            {audience === "full" && (
              <Badge variant="warning" className="mt-2 print:hidden">
                מסמך פנימי, כולל הערות עבודה
              </Badge>
            )}
            {audience === "full" && (
              <p className="mt-2 hidden text-xs font-semibold text-[#a4630a] print:block">
                מסמך פנימי, כולל הערות עבודה
              </p>
            )}
          </header>

          {answered.length > 0 && (
            <Section title="סיכום שיחת האפיון">
              {input.discoveryTitle && <p className="mb-3 text-sm text-[#6b6a75]">{input.discoveryTitle}</p>}
              <dl className="space-y-3">
                {answered.map((d, i) => (
                  <div key={i} className="break-inside-avoid">
                    <dt className="text-sm font-bold">{d.question}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-[#33323c]">
                      {d.answer.trim()}
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {(input.personas ?? []).length > 0 && (
            <Section title="פרסונות">
              <div className="space-y-5">
                {(input.personas ?? []).map((p, i) => (
                  <div key={i} className="break-inside-avoid rounded-xl border border-[#e5e4ea] p-4">
                    <h3 className="font-heading text-lg font-bold">{p.name || "פרסונה"}</h3>
                    <Lines lines={personaLines(p, audience)} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {input.journey && (input.journey.stages ?? []).length > 0 && (
            <Section title="מסע לקוח">
              {/* Each stage is its own unbreakable block, so the PDF never
                 splits a stage across two pages. */}
              <div className="space-y-4">
                {(input.journey.stages ?? []).map((s, i) => (
                  <div key={i} className="break-inside-avoid">
                    <Lines lines={journeyStageLines(s, i)} />
                  </div>
                ))}
                {audience === "full" && (input.journey.design_notes ?? "").trim() && (
                  <p className="break-inside-avoid text-sm text-[#4b4a55]">
                    המלצות עיצוב (פנימי): {input.journey.design_notes.trim()}
                  </p>
                )}
              </div>
            </Section>
          )}

          {input.sitemap && (input.sitemap.pages ?? []).length > 0 && (
            <Section title="מפת אתר">
              <div className="space-y-4">
                {(input.sitemap.pages ?? []).map((p, i) => (
                  <div key={i} className="break-inside-avoid">
                    <Lines lines={sitemapTopPageLines(p, audience)} />
                  </div>
                ))}
                {audience === "full" && (input.sitemap.design_notes ?? "").trim() && (
                  <p className="break-inside-avoid text-sm text-[#4b4a55]">
                    המלצות עיצוב (פנימי): {input.sitemap.design_notes.trim()}
                  </p>
                )}
              </div>
            </Section>
          )}

          <footer className="mt-8 border-t border-[#e5e4ea] pt-4 text-xs text-[#6b6a75]">
            סטודיו אורי גיא · origuystudio.com
          </footer>
        </article>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 font-heading text-xl font-bold text-[#14131a]">{title}</h2>
      {children}
    </section>
  );
}

/** Renders the shared line arrays. A blank string is a paragraph break, and a
 *  "- " prefix becomes a real bullet, so print and clipboard stay in sync. */
function Lines({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed text-[#33323c]">
      {lines.map((l, i) =>
        l.trim() === "" ? (
          <div key={i} className="h-2" />
        ) : l.startsWith("- ") ? (
          <p key={i} className="pr-4">
            • {l.slice(2)}
          </p>
        ) : l.startsWith("  ") ? (
          <p key={i} className="pr-6 text-[#4b4a55]">
            {l.trim()}
          </p>
        ) : (
          <p key={i}>{l}</p>
        ),
      )}
    </div>
  );
}
