import { ContractorApp } from "./contractor/ContractorApp";
import { KaarigarApp } from "./kaarigar/KaarigarApp";
import type { ContractorData } from "./contractor/types";
import type { KaarigarData } from "./kaarigar/types";
import contractor from "../data/contractor.json";
import kaarigar from "../data/kaarigar.json";
import "./mobile.css";

// The data loads with this module, like every other screen module's.
const KAARIGAR = kaarigar as KaarigarData;
const CONTRACTOR = contractor as ContractorData;

export interface MobileAppsScreenProps {
  /** `/mobile/kaarigar` or `/mobile/contractor`. */
  href: string;
  fallback: React.ReactNode;
}

/**
 * The two phone apps — Kaarigar (Acharya, PR #207) and Contractor (OmniPulse) —
 * each in a phone frame, on demo data. Each app owns its own navigation.
 */
export function MobileAppsScreen({ href, fallback }: MobileAppsScreenProps) {
  if (href === "/mobile/kaarigar") return <KaarigarApp data={KAARIGAR} />;
  if (href === "/mobile/contractor") return <ContractorApp data={CONTRACTOR} />;
  return <>{fallback}</>;
}

export default MobileAppsScreen;
