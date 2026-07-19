import { supabase } from "./supabase";
import { fnErrorMessage } from "./invite";
import type {
  BriefContent,
  CopyContent,
  JourneyContent,
  PersonaContent,
  SeoContent,
  SitemapContent,
} from "@/types/database";

/** Generate page/section copy that follows the project's sitemap, grounded in the
 *  discovery + personas + journey. Requires an existing sitemap. */
export type CopyVoice = "first_singular" | "first_plural" | "third";
export type CopyTone = "warm" | "professional" | "energetic" | "calm" | "luxury";

export async function generateCopy(payload: {
  title: string;
  items: { question: string; answer: string }[];
  personas?: JourneyPersonaHint[];
  journey?: JourneyContent | null;
  sitemap: SitemapContent;
  voice?: CopyVoice;
  tone?: CopyTone;
}): Promise<{ ok: boolean; copy?: CopyContent; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: {
        mode: "copy",
        title: payload.title,
        items: payload.items,
        personas: payload.personas ?? [],
        journey: payload.journey ?? null,
        sitemap: payload.sitemap,
        voice: payload.voice ?? "first_singular",
        tone: payload.tone ?? "warm",
      },
    });
    if (error) return { ok: false, error: await fnErrorMessage(error) };
    if (data && data.ok === false) return { ok: false, error: data.error || "generation failed" };
    return { ok: true, copy: data?.copy as CopyContent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Generate an SEO/AEO starter (per-page meta, keywords, AEO answer, FAQs, JSON-LD),
 *  grounded in the discovery + personas + sitemap. Requires an existing sitemap. */
export async function generateSeo(payload: {
  title: string;
  items: { question: string; answer: string }[];
  personas?: JourneyPersonaHint[];
  sitemap: SitemapContent;
}): Promise<{ ok: boolean; seo?: SeoContent; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: {
        mode: "seo",
        title: payload.title,
        items: payload.items,
        personas: payload.personas ?? [],
        sitemap: payload.sitemap,
      },
    });
    if (error) return { ok: false, error: await fnErrorMessage(error) };
    if (data && data.ok === false) return { ok: false, error: data.error || "generation failed" };
    return { ok: true, seo: data?.seo as SeoContent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Generate a content-collection brief (what to gather from the client), grounded
 *  in the discovery + personas + sitemap. Requires an existing sitemap. */
export async function generateBrief(payload: {
  title: string;
  items: { question: string; answer: string }[];
  personas?: JourneyPersonaHint[];
  sitemap: SitemapContent;
}): Promise<{ ok: boolean; brief?: BriefContent; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: {
        mode: "brief",
        title: payload.title,
        items: payload.items,
        personas: payload.personas ?? [],
        sitemap: payload.sitemap,
      },
    });
    if (error) return { ok: false, error: await fnErrorMessage(error) };
    if (data && data.ok === false) return { ok: false, error: data.error || "generation failed" };
    return { ok: true, brief: data?.brief as BriefContent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Generate a sitemap tree, grounded in the project's personas + journey. */
export async function generateSitemap(payload: {
  title: string;
  items: { question: string; answer: string }[];
  personas?: JourneyPersonaHint[];
  journey?: JourneyContent | null;
}): Promise<{ ok: boolean; sitemap?: SitemapContent; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: {
        mode: "sitemap",
        title: payload.title,
        items: payload.items,
        personas: payload.personas ?? [],
        journey: payload.journey ?? null,
      },
    });
    if (error) return { ok: false, error: await fnErrorMessage(error) };
    if (data && data.ok === false) return { ok: false, error: data.error || "generation failed" };
    return { ok: true, sitemap: data?.sitemap as SitemapContent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface JourneyPersonaHint {
  name: string;
  archetype: string;
  summary: string;
  goals: string[];
  pains: string[];
}

/** Result shapes for the per-page sitemap AI helpers. */
export type SitemapAssistResult =
  | { sections: string[] } // task = "sections"
  | { sections: string[]; rationale: string } // task = "reorder"
  | { subpages: SitemapContent["pages"] }; // task = "subpages"

/** Per-page AI helper for the sitemap editor: recommend sections to add,
 *  reorder the current sections (with a rationale), or suggest sub-pages. */
export async function sitemapAssist(payload: {
  task: "sections" | "reorder" | "subpages";
  title: string;
  page: { name: string; purpose: string; sections: string[]; serves: string };
  personas?: JourneyPersonaHint[];
  journey?: JourneyContent | null;
}): Promise<{ ok: boolean; result?: SitemapAssistResult; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: {
        mode: "sitemap_assist",
        task: payload.task,
        title: payload.title,
        page: payload.page,
        personas: payload.personas ?? [],
        journey: payload.journey ?? null,
      },
    });
    if (error) return { ok: false, error: await fnErrorMessage(error) };
    if (data && data.ok === false) return { ok: false, error: data.error || "generation failed" };
    return { ok: true, result: data?.result as SitemapAssistResult };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Generate a customer-journey map from a discovery call (senior-UX AI brief),
 *  grounded in the project's personas when provided. */
export async function generateJourney(payload: {
  title: string;
  items: { question: string; answer: string }[];
  personas?: JourneyPersonaHint[];
}): Promise<{ ok: boolean; journey?: JourneyContent; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: {
        mode: "journey",
        title: payload.title,
        items: payload.items,
        personas: payload.personas ?? [],
      },
    });
    if (error) return { ok: false, error: await fnErrorMessage(error) };
    if (data && data.ok === false) return { ok: false, error: data.error || "generation failed" };
    return { ok: true, journey: data?.journey as JourneyContent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Generate ONE persona from the admin's own free-text description. The
 *  discovery call is optional background (a project without one still works);
 *  `existing_names` keeps the AI from reusing a name already in the project.
 *  Additive by design , the caller appends the result, never replacing. */
export async function generatePersonaSingle(payload: {
  title: string;
  description: string;
  items?: { question: string; answer: string }[];
  existingNames?: string[];
}): Promise<{ ok: boolean; persona?: PersonaContent; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: {
        mode: "persona_single",
        title: payload.title,
        description: payload.description,
        items: payload.items ?? [],
        existing_names: payload.existingNames ?? [],
      },
    });
    if (error) return { ok: false, error: await fnErrorMessage(error) };
    if (data && data.ok === false) return { ok: false, error: data.error || "generation failed" };
    if (!data?.persona) return { ok: false, error: "לא נוצרה פרסונה. נסה שוב." };
    return { ok: true, persona: data.persona as PersonaContent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Generate an array of personas from a discovery call (senior-UX AI brief). */
export async function generatePersonas(payload: {
  title: string;
  items: { question: string; answer: string }[];
}): Promise<{ ok: boolean; personas?: PersonaContent[]; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: { mode: "personas", title: payload.title, items: payload.items },
    });
    if (error) return { ok: false, error: await fnErrorMessage(error) };
    if (data && data.ok === false) return { ok: false, error: data.error || "generation failed" };
    return { ok: true, personas: (data?.personas ?? []) as PersonaContent[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Generate a portrait for one persona; returns the public avatar URL or null. */
export async function generatePersonaImage(
  persona: PersonaContent,
  projectId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-deliverable", {
      body: { mode: "image", persona, project_id: projectId },
    });
    if (error || (data && data.ok === false)) return null;
    return (data?.avatar_url as string | null) ?? null;
  } catch {
    return null;
  }
}
