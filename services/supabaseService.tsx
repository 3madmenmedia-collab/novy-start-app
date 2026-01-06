
import { supabase } from '../lib/supabase';
import { User, Goal, UserTier, DailyTask, TaskCompletion, Checkpoint } from '../types';

// Helper function to generate milestones based on duration rules
const generateMilestones = (startStr: string, targetStr: string): string[] => {
    const start = new Date(startStr);
    const target = new Date(targetStr);
    
    // Safety check for invalid dates
    if (isNaN(start.getTime()) || isNaN(target.getTime()) || start >= target) return [];

    const diffTime = Math.abs(target.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const milestones: string[] = [];

    // Logic implementation
    if (diffDays <= 32) { 
        // <= 1 month (approx): 1 checkpoint in the middle
        const mid = new Date(start.getTime() + (diffTime / 2));
        milestones.push(mid.toISOString().split('T')[0]);
    } else if (diffDays <= 93) {
        // > 1 month AND <= 3 months: 3 checkpoints (25%, 50%, 75%)
        milestones.push(new Date(start.getTime() + (diffTime * 0.25)).toISOString().split('T')[0]);
        milestones.push(new Date(start.getTime() + (diffTime * 0.50)).toISOString().split('T')[0]);
        milestones.push(new Date(start.getTime() + (diffTime * 0.75)).toISOString().split('T')[0]);
    } else {
        // > 3 months: Every month
        let ptr = new Date(start);
        ptr.setMonth(ptr.getMonth() + 1);
        while (ptr < target) {
            milestones.push(ptr.toISOString().split('T')[0]);
            ptr.setMonth(ptr.getMonth() + 1);
        }
    }
    
    return milestones;
};

// Pomocná funkce pro mapování DB objektů na TypeScript typy
const mapGoalFromDB = (g: any): Goal => ({
  id: g.id,
  userId: g.user_id,
  title: g.title,
  description: g.description,
  category: g.category,
  startDate: g.start_date,
  targetDate: g.target_date,
  progress: g.progress,
  createdAt: g.created_at,
  streak: g.streak,
  image: g.image,
  dailyTasks: g.daily_tasks ? g.daily_tasks.map((t: any) => ({
    id: t.id,
    title: t.title,
    daysOfWeek: t.days_of_week
  })) : [],
  completions: g.task_completions ? g.task_completions.map((c: any) => ({
    date: c.date,
    taskId: c.task_id
  })) : [],
  checkpoints: g.checkpoints ? g.checkpoints.map((cp: any) => ({
    id: cp.id,
    date: cp.date,
    value: cp.value,
    note: cp.note,
    manualProgressAdjustment: cp.manual_progress_adjustment
  })) : [],
  plannedCheckpoints: generateMilestones(g.start_date, g.target_date),
  aiHistory: g.ai_history ? g.ai_history.map((h: any) => ({
    date: h.date,
    message: h.message
  })) : []
});

export const supabaseService = {
  // --- AUTH ---
  
  register: async (email: string, name: string) => {
    // V reálu se zde použije supabase.auth.signUp()
    // Toto pošle Magic Link na email
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { name } // Uloží se do meta dat a trigger to pak dá do profilu
      }
    });
    return { data, error };
  },

  getActiveUser: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) return null;

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      tier: profile.tier as UserTier,
      trialStartedAt: profile.trial_started_at,
      hasCompletedOnboarding: true,
      subscriptionStatus: profile.subscription_status,
      subscriptionRenewsAt: profile.subscription_renews_at,
      stripeCustomerId: profile.stripe_customer_id,
      // Gamification & AI fields
      xp: profile.xp || 0,
      level: profile.level || 1,
      badges: profile.badges || [],
      streakFreezes: profile.streak_freezes || 0,
      aiPersona: profile.ai_persona || 'zen',
      lastDailyBriefingDate: profile.last_daily_briefing_date
    };
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  // --- DATA ---

  getGoals: async (userId: string): Promise<Goal[]> => {
    // Načteme cíle i se všemi závislými daty najednou
    const { data, error } = await supabase
      .from('goals')
      .select(`
        *,
        daily_tasks (*),
        task_completions (*),
        checkpoints (*),
        ai_history (*)
      `)
      .eq('user_id', userId);

    if (error) {
      console.error(error);
      return [];
    }

    return data.map(mapGoalFromDB);
  },

  saveGoal: async (goal: Omit<Goal, 'id' | 'createdAt' | 'progress' | 'plannedCheckpoints'>) => {
    // 1. Uložit Goal
    const { data: goalData, error: goalError } = await supabase
      .from('goals')
      .insert({
        user_id: goal.userId,
        title: goal.title,
        description: goal.description,
        category: goal.category,
        start_date: goal.startDate,
        target_date: goal.targetDate,
        created_at: Date.now(),
        image: goal.image,
        streak: 0,
        progress: 0
      })
      .select()
      .single();

    if (goalError || !goalData) throw goalError;

    // 2. Uložit Daily Tasks
    if (goal.dailyTasks.length > 0) {
      const tasksToInsert = goal.dailyTasks.map(t => ({
        goal_id: goalData.id,
        title: t.title,
        days_of_week: t.daysOfWeek
      }));
      await supabase.from('daily_tasks').insert(tasksToInsert);
    }

    return goalData;
  },

  updateGoal: async (goal: Goal) => {
    // Pro jednoduchost aktualizujeme jen hlavní pole cíle
    // Úkoly a completions se řeší zvlášť v optimalizované aplikaci
    await supabase
      .from('goals')
      .update({
        title: goal.title,
        description: goal.description,
        target_date: goal.targetDate,
        image: goal.image,
        progress: goal.progress, // Progress by se měl ideálně počítat na backendu
        streak: goal.streak
      })
      .eq('id', goal.id);
  },

  deleteGoal: async (id: string) => {
    await supabase.from('goals').delete().eq('id', id);
  },

  toggleTask: async (goalId: string, taskId: string, date: string, isCompleted: boolean) => {
    if (isCompleted) {
      // Smazat completion
      // Poznámka: v reálu potřebujeme ID completion, nebo mazat podle task_id + date
      await supabase
        .from('task_completions')
        .delete()
        .eq('task_id', taskId)
        .eq('date', date);
    } else {
      // Přidat completion
      await supabase
        .from('task_completions')
        .insert({
          goal_id: goalId,
          task_id: taskId,
          date: date
        });
    }
  },

  addCheckpoint: async (goalId: string, checkpoint: Omit<Checkpoint, 'id'>) => {
    await supabase.from('checkpoints').insert({
      goal_id: goalId,
      date: checkpoint.date,
      value: checkpoint.value,
      note: checkpoint.note,
      manual_progress_adjustment: checkpoint.manualProgressAdjustment
    });
  }
};
