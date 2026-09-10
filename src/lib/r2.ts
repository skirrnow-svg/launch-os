/**
 * Cloudflare R2 storage client (STUB) — asset CDN, zero egress. S3-compatible.
 * Reads R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY /
 * R2_BUCKET_NAME from the env.
 * TODO(phase-2): implement with @aws-sdk/client-s3 pointed at the R2 endpoint
 * (https://<accountId>.r2.cloudflarestorage.com).
 */

export interface PutObjectParams {
  key: string;
  body: Uint8Array | Buffer | string;
  contentType?: string;
}

export async function putObject(_params: PutObjectParams): Promise<{ url: string }> {
  // TODO(phase-2): upload to R2 and return the public/CDN URL.
  throw new Error("TODO(phase-2): R2 putObject() not implemented");
}
