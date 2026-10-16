import type { Metadata } from "next";
import { WorkShell } from "@/components/host/shell";
import type { NavItem } from "@/components/host/side-nav";
import { requireAdminPage } from "@/server/host/access";

export const instant = false;

export const metadata: Metadata = {
  title: { default: "Operations", template: "%s | Operations" },
  robots: { index: false, follow: false },
};

const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/host", label: "Your hosting" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdminPage("/admin");
  return (
    <WorkShell area="Operations" areaHref="/admin" nav={adminNav} navLabel="Operations">
      {children}
    </WorkShell>
  );
}
