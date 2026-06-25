// ─── OpenProject journals adapter (read-only) ─────────
// Pulls work-package activity (journals) with REAL edit timestamps + actor, to
// provide an edit timeline beyond git commits. Actor is /api/v3/users/{id};
// names are resolved lazily and cached (avoids needing the /users list perm).

export interface ActivityEvent {
  taskId: number;
  journalId: number;
  userName: string | null;
  activityAt: string; // ISO
}

export class OpenProjectJournalsAdapter {
  private userCache = new Map<string, string | null>();
  constructor(private config: { baseUrl: string; token: string }) {}

  private headers() {
    return { Authorization: 'Basic ' + Buffer.from('apikey:' + this.config.token).toString('base64') };
  }

  private async userName(uid: string): Promise<string | null> {
    if (!uid) return null;
    const cached = this.userCache.get(uid);
    if (cached !== undefined) return cached;
    let name: string | null = null;
    try {
      const resp = await fetch(`${this.config.baseUrl}/users/${uid}`, { headers: this.headers() });
      if (resp.ok) {
        const u = (await resp.json()) as { name?: string };
        name = u.name ?? null;
      }
    } catch {
      // unreachable / forbidden → leave null; caller drops unattributable events
    }
    this.userCache.set(uid, name);
    return name;
  }

  /** Journal events for one work package, newer than `sinceMs`, actor-resolved. */
  async fetchActivities(wpId: number, sinceMs: number): Promise<ActivityEvent[]> {
    type ActivitiesResponse = { _embedded?: { elements?: Array<{ id: number; createdAt?: string; _links?: { user?: { href?: string } } }> } };
    let data: ActivitiesResponse;
    try {
      const resp = await fetch(`${this.config.baseUrl}/work_packages/${wpId}/activities`, { headers: this.headers() });
      if (!resp.ok) return [];
      data = (await resp.json()) as ActivitiesResponse;
    } catch {
      return [];
    }
    const out: ActivityEvent[] = [];
    for (const j of data._embedded?.elements ?? []) {
      if (!j.createdAt || new Date(j.createdAt).getTime() < sinceMs) continue;
      const uid = (j._links?.user?.href ?? '').split('/').pop() ?? '';
      out.push({ taskId: wpId, journalId: j.id, userName: await this.userName(uid), activityAt: j.createdAt });
    }
    return out;
  }
}
