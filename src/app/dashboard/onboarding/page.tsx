import { redirect } from "next/navigation";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import OnboardingWizard from "./wizard";

/**
 * First-run onboarding. Server wrapper: if the org already has a project the
 * wizard is unnecessary, so we send the user straight to the dashboard.
 */
export default async function OnboardingPage() {
  const { org } = await getContext();
  const projectCount = await prisma.projects.count({
    where: { org_id: org.id, deleted_at: null },
  });
  if (projectCount > 0) redirect("/dashboard");

  return <OnboardingWizard initialOrgName={org.name} />;
}
