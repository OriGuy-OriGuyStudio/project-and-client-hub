import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  TIER_ORDER,
  TIER_META,
  baseFeatures,
  appendDerived,
  type ServiceTier,
  type ServiceSiteType,
} from "@/lib/service-plans";
import type { ServicePlanContent } from "@/types/database";

// Live, editable package config. Read from service_plan_content (DB), with the
// code values from service-plans.ts as the fallback until it loads / if a row is
// missing. The landing and new agreements read this; existing signed agreements
// keep their own frozen snapshot.

export interface PlanConfig {
  tier: ServiceTier;
  name: string;
  label: string;
  tagline: string;
  price: number;
  responseHours: number;
  hours: number;
  // Descriptive feature lists (the hours/response lines are derived, not stored).
  features: Record<ServiceSiteType, string[]>;
}

export function defaultPlanConfig(tier: ServiceTier): PlanConfig {
  const m = TIER_META[tier];
  return {
    tier,
    name: m.name,
    label: m.label,
    tagline: m.tagline,
    price: m.price,
    responseHours: m.responseHours,
    hours: m.hours,
    features: { wordpress: baseFeatures(tier, "wordpress"), custom: baseFeatures(tier, "custom") },
  };
}

function fromRow(r: ServicePlanContent): PlanConfig {
  return {
    tier: r.tier as ServiceTier,
    name: r.name,
    label: r.label,
    tagline: r.tagline,
    price: Number(r.price),
    responseHours: r.response_hours,
    hours: r.hours,
    features: {
      wordpress: Array.isArray(r.features_wp) ? r.features_wp : [],
      custom: Array.isArray(r.features_custom) ? r.features_custom : [],
    },
  };
}

export type PlanConfigMap = Record<ServiceTier, PlanConfig>;

function defaultsMap(): PlanConfigMap {
  const map = {} as PlanConfigMap;
  for (const t of TIER_ORDER) map[t] = defaultPlanConfig(t);
  return map;
}

/** Live package config keyed by tier. `config` is always usable (code defaults
 * until the DB row loads), so callers can stay synchronous. */
export function usePlanConfig() {
  const query = useQuery({
    queryKey: ["plan-config"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlanConfigMap> => {
      const { data, error } = await supabase.from("service_plan_content").select("*");
      if (error) throw error;
      const rows = (data ?? []) as ServicePlanContent[];
      const map = {} as PlanConfigMap;
      for (const t of TIER_ORDER) {
        const row = rows.find((r) => r.tier === t);
        map[t] = row ? fromRow(row) : defaultPlanConfig(t);
      }
      return map;
    },
  });
  return { config: query.data ?? defaultsMap(), isLoading: query.isLoading, query };
}

/** Full feature list for a plan (descriptive + derived hours/response lines). */
export function planFeatures(cfg: PlanConfig, site: ServiceSiteType): string[] {
  return appendDerived(cfg.features[site], cfg.hours, cfg.responseHours);
}
