import type { Metadata } from "next";
import { EmptyState } from "@/components/ui";
import { FilterBar, one, Pager } from "@/components/admin/filters";
import { RoleSelect } from "@/components/admin/row-actions";
import { PageHeader } from "@/components/host/shell";
import { humanStatus, Table, Td, Th } from "@/components/host/table";
import { formatDate } from "@/lib/dates";
import { roles, searchUsers, userFilterSchema } from "@/server/admin/users";
import { requireAdminPage } from "@/server/host/access";

export const instant = false;
export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const viewer = await requireAdminPage("/admin/users");
  const sp = await searchParams;
  const filter = userFilterSchema.parse({ q: one(sp.q), role: one(sp.role), page: one(sp.page) });
  const { rows, hasMore, page } = await searchUsers(filter);

  return (
    <>
      <PageHeader title="Users" description="Hosts can list places. Admins can use this console. Making someone a host also creates their host profile." />
      <FilterBar
        action="/admin/users"
        search={{ name: "q", label: "Name or email", value: filter.q }}
        selects={[{ name: "role", label: "Role", value: filter.role, options: roles.map((r) => ({ value: r, label: humanStatus(r) })) }]}
      />
      {rows.length === 0 ? (
        <EmptyState title="No users match">Check the spelling of the email, or clear the role filter.</EmptyState>
      ) : (
        <Table caption="Users">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th numeric>Listings</Th>
              <Th>Joined</Th>
              <Th>Role</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <Td>
                  {u.name}
                  {u.hostName && u.hostName !== u.name && <span className="block text-xs text-slate">Hosts as {u.hostName}</span>}
                </Td>
                <Td className="break-all">
                  {u.email}
                  {!u.emailVerified && <span className="block text-xs text-slate">Email not verified</span>}
                </Td>
                <Td numeric>{u.listingCount}</Td>
                <Td className="whitespace-nowrap text-slate">{formatDate(u.createdAt)}</Td>
                <Td>
                  <RoleSelect userId={u.id} role={u.role} self={u.id === viewer.id} name={u.name || u.email} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pager path="/admin/users" params={{ q: filter.q, role: filter.role }} page={page} hasMore={hasMore} />
    </>
  );
}
