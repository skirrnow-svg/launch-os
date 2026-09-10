/**
 * Buffer API client (STUB) — social post scheduling across channels. Reads
 * BUFFER_API_TOKEN from the env. Social webhooks land at /api/webhooks/buffer.
 * TODO(phase-2): implement createUpdate() / listProfiles().
 */

export interface ScheduleParams {
  profileIds: string[];
  text: string;
  mediaUrl?: string;
  scheduledAt?: string; // ISO 8601
}

export async function schedulePost(_params: ScheduleParams): Promise<{ id: string }> {
  // TODO(phase-2): call Buffer and return the update id.
  throw new Error("TODO(phase-2): Buffer schedulePost() not implemented");
}
