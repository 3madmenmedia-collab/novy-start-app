
export enum UserTier {
  TRIAL = 'TRIAL',
  PREMIUM = 'PREMIUM'
}

export type AIPersona = 'zen' | 'drill' | 'analytic';

export interface Badge {
  id: string;
  earnedAt: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  tier: UserTier;
  trialStartedAt: number;
  hasCompletedOnboarding: boolean;
  // Stripe related fields
  subscriptionStatus?: 'active' | 'canceled' | 'past_due';
  subscriptionRenewsAt?: number; // Timestamp
  stripeCustomerId?: string;
  
  // Gamification
  xp: number;
  level: number;
  badges: Badge[];
  streakFreezes: number;
  
  // AI Settings
  aiPersona: AIPersona;
  lastDailyBriefingDate?: string; // YYYY-MM-DD
}

export interface DailyTask {
  id: string;
  title: string;
  daysOfWeek: number[]; // 1 = Pondělí, 7 = Neděle
}

export interface TaskCompletion {
  date: string; // YYYY-MM-DD
  taskId: string;
}

export interface Checkpoint {
  id: string;
  date: string;
  value: string;
  note: string;
  manualProgressAdjustment?: number;
}

export interface AIAdvice {
  date: string;
  message: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  targetDate: string;
  progress: number;
  createdAt: number;
  streak: number;
  lastCheckInDate?: string;
  dailyTasks: DailyTask[];
  completions: TaskCompletion[];
  checkpoints: Checkpoint[]; // Již splněné/zadané body
  plannedCheckpoints: string[]; // Seznam dat (YYYY-MM-DD) automaticky vygenerovaných milníků
  aiHistory: AIAdvice[];
  image?: string; // Base64 encoded image
}
