// Reads the generation runner's last-reported provider auth health from
// platform_settings (written by runner/process-jobs.mjs each run). Prints one
// line the secret-sync shell script can parse:
//   CLAUDE=ok|down|unknown HF=ok|down|unknown STALE=yes|no
// STALE=yes means the runner hasn't reported in >3h (so the flags are unreliable).
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  try {
    const r = await prisma.$queryRawUnsafe(
      "SELECT claude_auth_ok, higgsfield_auth_ok, auth_checked_at FROM platform_settings LIMIT 1",
    );
    const row = r[0] || {};
    const s = (v) => (v === false ? "down" : v === true ? "ok" : "unknown");
    const checked = row.auth_checked_at ? new Date(row.auth_checked_at).getTime() : 0;
    const stale = !checked || Date.now() - checked > 3 * 60 * 60 * 1000 ? "yes" : "no";
    console.log(`CLAUDE=${s(row.claude_auth_ok)} HF=${s(row.higgsfield_auth_ok)} STALE=${stale}`);
  } catch {
    console.log("CLAUDE=unknown HF=unknown STALE=yes");
  } finally {
    await prisma.$disconnect();
  }
})();
