export type SeasonTier = "Seedling" | "Pathfinder" | "Scribe" | "Elder";

export interface TierDefinition {
  tier: SeasonTier;
  minPoints: number;
  color: string;
  description: string;
}

export const SEASON_TIERS: TierDefinition[] = [
  { tier: "Seedling", minPoints: 0, color: "#48BB78", description: "Beginning the journey in the Word" },
  { tier: "Pathfinder", minPoints: 100, color: "#4299E1", description: "Walking faithfully through Scripture" },
  { tier: "Scribe", minPoints: 300, color: "#9F7AEA", description: "Deep familiarity with biblical truth" },
  { tier: "Elder", minPoints: 600, color: "#ED8936", description: "Mastery and steadfast leadership" },
];

export interface SeasonReward {
  id: string;
  name: string;
  type: "title" | "accent" | "badge" | "frame";
  requiredTier: SeasonTier;
  description: string;
  icon: string;
}

export const AUTUMN_ASCENSION_REWARDS: SeasonReward[] = [
  {
    id: "reward-autumn-learner",
    name: "Autumn Learner",
    type: "title",
    requiredTier: "Seedling",
    description: "Honors your entry into the Autumn Ascension season.",
    icon: "sparkles",
  },
  {
    id: "reward-pathfinder-accent",
    name: "Pathfinder Accent",
    type: "accent",
    requiredTier: "Pathfinder",
    description: "Custom blue profile banner accent for faithful progression.",
    icon: "flame.fill",
  },
  {
    id: "reward-scribe-badge",
    name: "Scribe Badge",
    type: "badge",
    requiredTier: "Scribe",
    description: "Commemorative seal of scripture memorization and study.",
    icon: "book.fill",
  },
  {
    id: "reward-elder-frame",
    name: "Elder Frame",
    type: "frame",
    requiredTier: "Elder",
    description: "Prestigious gold avatar frame for seasoned champions.",
    icon: "crown.fill",
  },
];

const TIER_ORDER: Record<SeasonTier, number> = {
  Seedling: 0,
  Pathfinder: 1,
  Scribe: 2,
  Elder: 3,
};

export function calculateSeasonTier(points: number): {
  currentTier: SeasonTier;
  nextTier: SeasonTier | null;
  pointsToNext: number;
  progressPercent: number;
} {
  const safePoints = Math.max(0, points);
  let currentTier: SeasonTier = "Seedling";
  let nextTier: SeasonTier | null = "Pathfinder";

  if (safePoints >= 600) {
    currentTier = "Elder";
    nextTier = null;
  } else if (safePoints >= 300) {
    currentTier = "Scribe";
    nextTier = "Elder";
  } else if (safePoints >= 100) {
    currentTier = "Pathfinder";
    nextTier = "Scribe";
  } else {
    currentTier = "Seedling";
    nextTier = "Pathfinder";
  }

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      pointsToNext: 0,
      progressPercent: 100,
    };
  }

  const currentDef = SEASON_TIERS.find((t) => t.tier === currentTier)!;
  const nextDef = SEASON_TIERS.find((t) => t.tier === nextTier)!;
  const span = nextDef.minPoints - currentDef.minPoints;
  const earnedInTier = safePoints - currentDef.minPoints;
  const progressPercent = Math.min(100, Math.max(0, Math.round((earnedInTier / span) * 100)));
  const pointsToNext = Math.max(0, nextDef.minPoints - safePoints);

  return {
    currentTier,
    nextTier,
    pointsToNext,
    progressPercent,
  };
}

export function isRewardEligible(currentTier: SeasonTier, requiredTier: SeasonTier): boolean {
  return TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];
}
