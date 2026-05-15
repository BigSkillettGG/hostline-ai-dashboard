import { getDemoBusinessLabel, verticalDemoProfiles } from "@/domain/demo-verticals";
import type { BusinessType } from "@/domain/business-templates";
import type { SignalHostVoiceProfileId } from "@/domain/voice-selection";

export type TenantStatus = "healthy" | "attention" | "critical";

export interface Tenant {
  accountEmail?: string;
  aiNumber: string;
  businessLabel?: string;
  businessType?: BusinessType;
  callsThisMonth: number;
  city: string;
  createdAt: string;
  id: string;
  includedCalls: number;
  locationId?: string;
  mrrCents: number;
  name: string;
  organizationId?: string;
  ownerEmail: string;
  plan: "Basic" | "Growth" | "Premium" | "Pro" | "Starter";
  status: TenantStatus;
  voiceProfileId?: SignalHostVoiceProfileId;
  websiteDemoPath?: string;
}

const callsByProfile: Record<string, number> = {
  "brightwire-electric": 436,
  "harbor-plumbing": 512,
  "luna-studio": 176,
  "olive-ember": 612,
  "ridgeline-roofing": 931,
  "summit-air": 688,
};

export const tenants: Tenant[] = verticalDemoProfiles.map((profile, index) => ({
  accountEmail: profile.accountEmail,
  aiNumber: profile.aiNumber,
  businessLabel: getDemoBusinessLabel(profile),
  businessType: profile.businessType,
  callsThisMonth: callsByProfile[profile.demoSiteSlug] ?? 100 + index * 78,
  city: profile.city,
  createdAt: `2026-0${Math.min(index + 1, 6)}-12`,
  id: profile.demoSiteSlug,
  includedCalls: profile.includedInteractions,
  locationId: profile.locationId,
  mrrCents: profile.mrrCents,
  name: profile.businessName,
  organizationId: profile.organizationId,
  ownerEmail: profile.ownerEmail,
  plan: profile.planName,
  status: profile.status,
  voiceProfileId: profile.voiceProfileId,
  websiteDemoPath: `/demo-sites/${profile.demoSiteSlug}`,
}));
