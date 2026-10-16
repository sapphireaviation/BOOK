import type { Metadata } from "next";
import { PageHeader } from "@/components/host/shell";
import { ProfileForm } from "@/components/host/profile-form";
import { actorOf, requireHostPage } from "@/server/host/access";
import { getHostProfile } from "@/server/host/profile";

export const instant = false;
export const metadata: Metadata = { title: "Host profile" };

export default async function ProfilePage() {
  const viewer = await requireHostPage("/host/profile");
  const profile = await getHostProfile(actorOf(viewer));
  return (
    <div className="max-w-4xl">
      <PageHeader title="Host profile" description={`Signed in as ${viewer.email}.`} />
      <ProfileForm
        values={{
          displayName: profile?.displayName ?? viewer.name,
          about: profile?.about ?? "",
          languages: (profile?.languages ?? []).join(", "),
          payoutMethod: profile?.payoutMethod ?? "",
          payoutReference: profile?.payoutReference ?? "",
          taxId: profile?.taxId ?? "",
        }}
      />
    </div>
  );
}
