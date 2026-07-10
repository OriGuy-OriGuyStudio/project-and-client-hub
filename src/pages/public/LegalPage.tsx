import { useParams, Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LEGAL_DOCS, TERMS_DOC, PRIVACY_DOC } from "@/lib/legal-content";

/**
 * Public policy page (terms / privacy), reachable at /terms and /privacy.
 * Content comes from src/lib/legal-content.ts. Dark, RTL, readable measure.
 */
export default function LegalPage({ slug: slugProp }: { slug?: string }) {
  const params = useParams();
  const slug = slugProp || params.slug || "terms";
  const doc = LEGAL_DOCS[slug] ?? TERMS_DOC;
  const other = doc.slug === "terms" ? PRIVACY_DOC : TERMS_DOC;

  return (
    <div className="dark min-h-screen bg-background text-foreground" dir="rtl">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-16">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-primary">
          <ArrowRight className="size-4" /> חזרה
        </Link>

        <h1 className="mt-6 font-heading text-3xl font-black sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">עדכון אחרון: {doc.updated}</p>
        {doc.intro && <p className="mt-6 leading-relaxed text-muted-foreground">{doc.intro}</p>}

        <div className="mt-8 space-y-7">
          {doc.sections.map((s) => (
            <section key={s.h}>
              <h2 className="font-heading text-lg font-bold text-foreground">{s.h}</h2>
              <div className="mt-2 space-y-1.5">
                {s.body.map((line) =>
                  line.startsWith("• ") ? (
                    <p key={line} className="pr-4 leading-relaxed text-muted-foreground">{line}</p>
                  ) : (
                    <p key={line} className="leading-relaxed text-muted-foreground">{line}</p>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-sm">
          <Link to={`/${other.slug}`} className="text-primary hover:underline">
            {other.slug === "privacy" ? "מדיניות הפרטיות" : "תקנון האתר"}
          </Link>
        </div>
      </div>
    </div>
  );
}
