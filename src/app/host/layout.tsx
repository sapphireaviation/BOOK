import type { Metadata } from "next";
import { WorkShell } from "@/components/host/shell";
import type { NavItem } from "@/components/host/side-nav";
import { getViewer } from "@/server/host/access";

export const instant = false;

export const metadata: Metadata = {
  title: { default: "Hosting", template: "%s | Hosting" },
  robots: { index: false, follow: false },
};

const hostNav: NavItem[] = [
  { href: "/host", label: "Dashboard", exact: true },
  { href: "/host/listings", label: "Listings" },
  { href: "/host/bookings", label: "Bookings" },
  { href: "/host/payouts", label: "Payouts" },
  { href: "/host/profile", label: "Profile" },
];

export default async function HostLayout({ children }: LayoutProps<"/host">) {
  const viewer = await getViewer();
  const nav = viewer && (viewer.role === "host" || viewer.role === "admin") ? hostNav : null;
  const withAdmin = viewer?.role === "admin" ? [...hostNav, { href: "/admin", label: "Operations" }] : nav;
  return (
    <WorkShell area="Hosting" areaHref="/host" nav={withAdmin} navLabel="Hosting">
      {children}
    </WorkShell>
  );
}
