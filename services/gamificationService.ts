
import { User, Goal, Badge } from '../types';
import { BADGES_DEFINITIONS } from '../constants';

// Zkušenosti za akce
export const XP_REWARDS = {
  TASK_COMPLETION: 10,       // Jeden úkol
  GOAL_DAILY_COMPLETE: 30,   // Všechny úkoly jednoho cíle pro tento den
  MILESTONE_ENTRY: 50,
  GOAL_COMPLETION: 200,
  STREAK_WEEK: 100
};

export const gamificationService = {
  // Vypočítá potřebné XP pro další level (jednoduchá progrese: Level * 200)
  getNextLevelXp: (level: number) => level * 200,

  // Přidá XP a vrátí aktualizovaná data uživatele (zda došlo k level up)
  addXp: (user: User, amount: number): { user: User, leveledUp: boolean } => {
    let newXp = (user.xp || 0) + amount;
    let newLevel = user.level || 1;
    let leveledUp = false;
    
    let nextLevelThreshold = gamificationService.getNextLevelXp(newLevel);

    while (newXp >= nextLevelThreshold) {
      newXp -= nextLevelThreshold;
      newLevel++;
      leveledUp = true;
      nextLevelThreshold = gamificationService.getNextLevelXp(newLevel);
    }

    return {
      user: { ...user, xp: newXp, level: newLevel },
      leveledUp
    };
  },

  // Zkontroluje a přidělí nové odznaky na základě akce a stavu
  checkForBadges: (user: User, goals: Goal[], actionType: 'task' | 'milestone' | 'ai', context?: any): { user: User, newBadges: Badge[] } => {
    const existingBadgeIds = (user.badges || []).map(b => b.id);
    const newBadges: Badge[] = [];
    const now = Date.now();
    const currentHour = new Date().getHours();

    // Helper pro přidání
    const award = (id: string) => {
      if (!existingBadgeIds.includes(id)) {
        newBadges.push({ id, earnedAt: now });
        existingBadgeIds.push(id); // Abychom nepřidali 2x v jednom běhu
      }
    };

    // 1. FIRST STEP (První úkol)
    if (actionType === 'task') {
       award('first_step');
    }

    // 2. NIGHT OWL (Úkol po 22:00)
    if (actionType === 'task' && currentHour >= 22) {
       award('night_owl');
    }

    // 3. EARLY BIRD (Úkol před 8:00)
    if (actionType === 'task' && currentHour < 8) {
       award('early_bird');
    }

    // 5. MILESTONE MASTER (5 milníků)
    if (actionType === 'milestone') {
       const totalCheckpoints = goals.reduce((sum, g) => sum + g.checkpoints.length, 0);
       if (totalCheckpoints >= 5) {
         award('milestone_master');
       }
    }

    // 6. ON FIRE (Global streak check)
    if (context?.perfectStreak >= 7) {
       award('on_fire');
    }

    return {
      user: { ...user, badges: [...(user.badges || []), ...newBadges] },
      newBadges
    };
  }
};
