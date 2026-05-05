export type TenantStatus = "healthy" | "attention" | "critical";

export interface Tenant {
  id: string;
  name: string;
  city: string;
  plan: "Starter" | "Growth" | "Pro";
  status: TenantStatus;
  callsThisMonth: number;
  includedCalls: number;
  mrrCents: number;
  createdAt: string;
  ownerEmail: string;
  aiNumber: string;
}

export const tenants: Tenant[] = [
  { id: "olive-ember", name: "Olive & Ember", city: "San Francisco, CA", plan: "Growth", status: "healthy", callsThisMonth: 612, includedCalls: 800, mrrCents: 24900, createdAt: "2025-09-12", ownerEmail: "maria@oliveandember.com", aiNumber: "+1 (415) 555-0142" },
  { id: "sushi-kojo", name: "Sushi Kojō", city: "Los Angeles, CA", plan: "Pro", status: "healthy", callsThisMonth: 1480, includedCalls: 2000, mrrCents: 54900, createdAt: "2025-08-04", ownerEmail: "kenji@sushikojo.com", aiNumber: "+1 (213) 555-0188" },
  { id: "bodega-azul", name: "Bodega Azul", city: "Austin, TX", plan: "Starter", status: "attention", callsThisMonth: 198, includedCalls: 200, mrrCents: 9900, createdAt: "2025-10-22", ownerEmail: "ana@bodegaazul.com", aiNumber: "+1 (512) 555-0103" },
  { id: "thatch-house", name: "Thatch House", city: "Brooklyn, NY", plan: "Growth", status: "healthy", callsThisMonth: 540, includedCalls: 800, mrrCents: 24900, createdAt: "2025-07-19", ownerEmail: "nina@thatchhouse.com", aiNumber: "+1 (718) 555-0166" },
  { id: "north-pier", name: "North Pier Oyster", city: "Seattle, WA", plan: "Pro", status: "critical", callsThisMonth: 2110, includedCalls: 2000, mrrCents: 54900, createdAt: "2025-06-30", ownerEmail: "owner@northpier.com", aiNumber: "+1 (206) 555-0119" },
  { id: "milk-honey", name: "Milk & Honey Café", city: "Portland, OR", plan: "Starter", status: "healthy", callsThisMonth: 142, includedCalls: 200, mrrCents: 9900, createdAt: "2025-11-02", ownerEmail: "jamie@milkhoney.cafe", aiNumber: "+1 (503) 555-0154" },
  { id: "carbone-fig", name: "Carbone & Fig", city: "Chicago, IL", plan: "Growth", status: "attention", callsThisMonth: 760, includedCalls: 800, mrrCents: 24900, createdAt: "2025-09-30", ownerEmail: "lou@carboneandfig.com", aiNumber: "+1 (312) 555-0173" },
];
