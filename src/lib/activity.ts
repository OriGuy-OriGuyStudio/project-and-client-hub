import { supabase } from "./supabase";

/**
 * Append an immutable entry to a project's activity log. Best-effort: a logging
 * failure must never block the underlying user action, so errors are swallowed.
 */
export async function logActivity(params: {
  projectId: string;
  actorId: string | null;
  actionType: string;
  description: string;
}) {
  try {
    await supabase.from("activity_log").insert({
      project_id: params.projectId,
      actor_id: params.actorId,
      action_type: params.actionType,
      description: params.description,
    });
  } catch {
    /* non-fatal */
  }
}
