import { isInternalClient } from "./internal";
import { isDemoEmail } from "./demo";

type ClientLike = { id: string; email: string };

/**
 * Split projects into real clients / demo (test) / studio (internal), by their
 * owner's email. Used on the admin dashboard + projects page so the three never
 * mix. Unknown owners fall back to the "client" bucket.
 */
export function groupProjects<T extends { client_id: string }>(projects: T[], clients: ClientLike[] | undefined) {
  const emailById = new Map((clients ?? []).map((c) => [c.id, c.email]));
  const client: T[] = [];
  const demo: T[] = [];
  const studio: T[] = [];
  for (const p of projects) {
    const email = emailById.get(p.client_id);
    if (isInternalClient(email)) studio.push(p);
    else if (isDemoEmail(email)) demo.push(p);
    else client.push(p);
  }
  return { client, demo, studio };
}
