import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, MailPlus, ShieldCheck, UserRoundPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { canCurrentUserManageTeam, getRestaurantRoleLabel, isDemoWorkspace, useCurrentUser } from "@/lib/auth";
import {
  createTeamInvitationInSupabase,
  fetchTeamInvitationsFromSupabase,
  fetchTeamMembersFromSupabase,
  isTeamPersistenceConfigured,
} from "@/lib/supabase-rest";
import { users } from "@/data/mock";
import {
  createPendingTeamInvitation,
  getInitials,
  teamRoleDescriptions,
  type TeamInvitation,
  type TeamMember,
} from "@/domain/team";
import type { RestaurantMembershipRole } from "@/domain/access-control";

const LOCAL_INVITES_KEY = "hostline.demoTeamInvites";
const roleOptions: RestaurantMembershipRole[] = ["owner", "admin", "manager", "staff"];

const notifications = [
  { id: "missed", label: "Missed calls" },
  { id: "escalations", label: "Escalations" },
  { id: "new_orders", label: "New orders" },
  { id: "reservation_requests", label: "Reservation requests" },
  { id: "daily_digest", label: "Daily digest" },
];

const sampleMembers: TeamMember[] = users.map((user) => ({
  email: user.email,
  id: user.id,
  lastActive: user.lastActive,
  name: user.name,
  role: user.role.toLowerCase() as RestaurantMembershipRole,
}));

export default function Team() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RestaurantMembershipRole>("staff");
  const [localInvites, setLocalInvites] = useState<TeamInvitation[]>(() => loadLocalInvites());
  const canManageTeam = canCurrentUserManageTeam(user);
  const persistenceConfigured = isTeamPersistenceConfigured(user?.activeOrganizationId);

  const memberQuery = useQuery({
    enabled: persistenceConfigured,
    queryFn: () => fetchTeamMembersFromSupabase(user?.activeOrganizationId),
    queryKey: ["team-members", user?.activeOrganizationId],
  });

  const inviteQuery = useQuery({
    enabled: persistenceConfigured,
    queryFn: () => fetchTeamInvitationsFromSupabase(user?.activeOrganizationId),
    queryKey: ["team-invitations", user?.activeOrganizationId],
  });

  const inviteMutation = useMutation({
    mutationFn: (input: { email: string; role: RestaurantMembershipRole }) =>
      createTeamInvitationInSupabase(
        {
          email: input.email,
          invitedBy: user?.supabaseUserId,
          role: input.role,
        },
        user?.activeOrganizationId,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["team-invitations", user?.activeOrganizationId] });
    },
  });

  const usingSupabase = Boolean(persistenceConfigured && memberQuery.isSuccess);
  const members = useMemo(
    () => (usingSupabase ? (memberQuery.data ?? []) : sampleMembers),
    [memberQuery.data, usingSupabase],
  );
  const invitations = usingSupabase ? (inviteQuery.data ?? []) : localInvites;
  const workspaceLabel = isDemoWorkspace(user) ? "Demo workspace" : usingSupabase ? "Live Supabase" : "Sample data";

  const roleCounts = useMemo(() => {
    return members.reduce<Record<string, number>>((counts, member) => {
      counts[member.role] = (counts[member.role] ?? 0) + 1;
      return counts;
    }, {});
  }, [members]);

  const submitInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageTeam) {
      toast.error("Only owners and admins can invite teammates.");
      return;
    }

    try {
      if (usingSupabase) {
        await inviteMutation.mutateAsync({ email: inviteEmail, role: inviteRole });
      } else {
        const invitation = createPendingTeamInvitation({
          email: inviteEmail,
          invitedBy: user?.name,
          role: inviteRole,
        });
        const nextInvites = [invitation, ...localInvites].slice(0, 12);
        setLocalInvites(nextInvites);
        saveLocalInvites(nextInvites);
      }
      setInviteEmail("");
      setInviteRole("staff");
      setInviteOpen(false);
      toast.success("Invitation queued");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create invitation");
    }
  };

  return (
    <>
      <PageHeader
        title="Team"
        description="Invite teammates, assign restaurant roles, and control operational access"
        actions={
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!canManageTeam}>
                <UserRoundPlus className="mr-1.5 h-3.5 w-3.5" />
                Invite user
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={submitInvite}>
                <DialogHeader>
                  <DialogTitle>Invite teammate</DialogTitle>
                  <DialogDescription>
                    Send access to this restaurant workspace. Owners and admins can manage future invitations.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      autoComplete="email"
                      placeholder="chef@restaurant.com"
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as RestaurantMembershipRole)}>
                      <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((role) => (
                          <SelectItem key={role} value={role}>{getRestaurantRoleLabel(role)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{teamRoleDescriptions[inviteRole]}</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending ? "Inviting..." : "Send invite"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-primary" />
                    Members
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your role: {getRestaurantRoleLabel(user?.restaurantMembershipRole)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={usingSupabase ? "border-success/20 bg-success/10 text-success" : "bg-muted text-muted-foreground"}
                >
                  {workspaceLabel}
                </Badge>
              </CardHeader>
              <CardContent>
                {!canManageTeam && (
                  <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    Only owners and admins can change roles or invite teammates.
                  </div>
                )}
                {persistenceConfigured && memberQuery.isError && (
                  <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    Supabase team members could not be loaded, so this page is showing sample data.
                  </div>
                )}
                <div className="divide-y divide-border rounded-md border border-border">
                  {members.length ? members.map((member) => (
                    <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {getInitials(member.name || member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{member.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="hidden text-xs text-muted-foreground sm:inline">{member.lastActive ?? "Active"}</span>
                        <Select defaultValue={member.role} disabled={!canManageTeam || member.role === "owner"}>
                          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((role) => (
                              <SelectItem key={role} value={role}>{getRestaurantRoleLabel(role)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )) : (
                    <div className="p-4 text-sm text-muted-foreground">No team members found for this organization.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MailPlus className="h-4 w-4 text-primary" />
                  Pending invitations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border rounded-md border border-border">
                  {invitations.length ? invitations.map((invite) => (
                    <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <div>
                        <div className="text-sm font-medium">{invite.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {getRestaurantRoleLabel(invite.role)} access expires {formatInviteDate(invite.expiresAt)}
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">{invite.status}</Badge>
                    </div>
                  )) : (
                    <div className="p-4 text-sm text-muted-foreground">No pending invitations.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Access summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {roleOptions.map((role) => (
                  <div key={role} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{getRestaurantRoleLabel(role)}</div>
                      <Badge variant="secondary">{roleCounts[role] ?? 0}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{teamRoleDescriptions[role]}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-2 text-left font-medium">Event</th>
                        <th className="px-2 py-2 text-center font-medium">Email</th>
                        <th className="px-2 py-2 text-center font-medium">SMS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifications.map((notification) => (
                        <tr key={notification.id} className="border-b border-border last:border-0">
                          <td className="py-2.5">{notification.label}</td>
                          <td className="py-2.5 text-center"><Switch defaultChecked /></td>
                          <td className="py-2.5 text-center"><Switch defaultChecked={notification.id !== "daily_digest"} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function loadLocalInvites(): TeamInvitation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_INVITES_KEY);
    return raw ? (JSON.parse(raw) as TeamInvitation[]) : [];
  } catch {
    return [];
  }
}

function saveLocalInvites(invites: TeamInvitation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_INVITES_KEY, JSON.stringify(invites));
}

function formatInviteDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return "soon";
  }
}
