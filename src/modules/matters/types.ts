export const MATTER_TYPES = [
  "CRIMINAL",
  "CIVIL",
  "CORPORATE",
  "EMPLOYMENT",
  "FAMILY",
  "TAX",
  "REAL_ESTATE",
  "IMMIGRATION",
  "OTHER",
] as const;

export type MatterType = (typeof MATTER_TYPES)[number];

export const MATTER_STATUSES = ["OPEN", "CLOSED", "ARCHIVED"] as const;
export type MatterStatus = (typeof MATTER_STATUSES)[number];

export const MATTER_TYPE_LABELS: Record<MatterType, string> = {
  CRIMINAL: "Criminal",
  CIVIL: "Civil",
  CORPORATE: "Corporate",
  EMPLOYMENT: "Employment",
  FAMILY: "Family",
  TAX: "Tax",
  REAL_ESTATE: "Real Estate",
  IMMIGRATION: "Immigration",
  OTHER: "Other",
};
