import { supabase } from "./supabase";
import { fnErrorMessage } from "./invite";
import type { PersonaContent } from "@/types/database";

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
