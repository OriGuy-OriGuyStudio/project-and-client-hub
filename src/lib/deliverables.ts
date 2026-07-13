import { supabase } from "./supabase";
import { fnErrorMessage } from "./invite";
import type { JourneyContent, PersonaContent } from "@/types/database";

export interface JourneyPersonaHint {
  name: string;
  archetype: string;
  summary: string;
  goals: string[];
  pains: string[];
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
