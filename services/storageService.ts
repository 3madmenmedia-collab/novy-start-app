
import { User, Goal, UserTier, Checkpoint, DailyTask, TaskCompletion } from '../types';
import { supabase } from '../lib/supabase';

const getKeys = () => ({
  USERS: `resolutions_users`,
  GOALS: `resolutions_goals`,
  ACTIVE_USER_ID: `resolutions_active_user_id`
});

// Helper functions (same as before)
const generateMilestones = (startStr: string, targetStr: string): string[] => {
    const start = new Date(startStr);
    const target = new Date(targetStr);
    if (isNaN(start.getTime()) || isNaN(target.getTime()) || start >= target) return [];
    const diffTime = Math.abs(target.getTime() - start.getTime());
    const milestones: string[] = [];
    milestones.push(new Date(start.getTime() + (diffTime * 0.25)).toISOString().split('T')[0]);
    milestones.push(new Date(start.getTime() + (diffTime * 0.50)).toISOString().split('T')[0]);
    milestones.push(new Date(start.getTime() + (diffTime * 0.75)).toISOString().split('T')[0]);
    milestones.push(targetStr);
    return Array.from(new Set(milestones)).sort();
};

const calculateGoalProgressLocal = (goal: Goal): Goal => {
    const start = new Date(goal.startDate);
    const target = new Date(goal.targetDate);
    if (isNaN(start.getTime()) || isNaN(target.getTime())) return { ...goal, progress: 0 };

    let totalScheduledTasks = 0;
    let tempDate = new Date(start);
    while (tempDate <= target) {
      const dayOfWeek = tempDate.getUTCDay() === 0 ? 7 : tempDate.getUTCDay();
      const tasksOnThisDay = goal.dailyTasks.filter(t => t.daysOfWeek.includes(dayOfWeek)).length;
      totalScheduledTasks += tasksOnThisDay;
      tempDate.setDate(tempDate.getDate() + 1);
    }

    const valuePerTask = totalScheduledTasks > 0 ? (100 / totalScheduledTasks) : 0;
    let calculatedProgress = 0;
    
    const lastAdjCheckpoint = [...goal.checkpoints]
        .sort((a, b) => b.date.localeCompare(a.date))
        .find(cp => cp.manualProgressAdjustment !== undefined);

    if (lastAdjCheckpoint) {
        const baseProgress = lastAdjCheckpoint.manualProgressAdjustment!;
        const completionsAfterCheckpoint = goal.completions.filter(c => c.date > lastAdjCheckpoint.date).length;
        calculatedProgress = baseProgress + (completionsAfterCheckpoint * valuePerTask);
    } else {
        calculatedProgress = goal.completions.length * valuePerTask;
    }

    // Dynamic Streak Calculation
    let currentStreak = 0;
    let checkDate = new Date();
    // Start checking from yesterday (or today if fully completed)
    // For simplicity, we check backwards from today
    for (let i = 0; i < 365; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        
        // Skip future dates if somehow checked
        if (dateStr > new Date().toISOString().split('T')[0]) {
             checkDate.setDate(checkDate.getDate() - 1);
             continue;
        }

        if (dateStr < goal.startDate) break;

        const dayOfWeek = checkDate.getUTCDay() === 0 ? 7 : checkDate.getUTCDay();
        const daysTasks = goal.dailyTasks.filter(t => t.daysOfWeek.includes(dayOfWeek));
        
        if (daysTasks.length === 0) {
            // No tasks scheduled for this day, streak continues? 
            // Usually streak breaks only on days with tasks. 
            // Let's assume skip days don't break streak but don't add to it unless we want "daily streak".
            // Here: simple logic - if no tasks, skip day check.
        } else {
            const completedOnDay = daysTasks.filter(t => goal.completions.some(c => c.date === dateStr && c.taskId === t.id));
            if (completedOnDay.length === daysTasks.length) {
                currentStreak++;
            } else {
                // If it's today and not finished, don't break streak yet (it's in progress)
                if (dateStr === new Date().toISOString().split('T')[0]) {
                    // pass
                } else {
                    break;
                }
            }
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }

    return { 
        ...goal, 
        progress: Math.min(100, Math.round(calculatedProgress)),
        streak: currentStreak
    };
};

// --- SUPABASE MAPPERS ---
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
  streak: g.streak, // Will be recalculated by calculateGoalProgressLocal anyway
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

export const storageService = {
  // --- AUTH & USER ---

  getUsers: (): User[] => {
      // Used for local dev mainly
      const users: User[] = JSON.parse(localStorage.getItem(getKeys().USERS) || '[]');
      return users;
  },
  
  register: (email: string, name: string, externalId?: string): User => {
    // Local fallback registration
    const keys = getKeys();
    const users = storageService.getUsers();
    const existing = users.find(u => u.email === email);
    if (existing) return existing;

    const newUser: User = {
      id: externalId || Math.random().toString(36).substr(2, 9),
      email,
      name,
      tier: UserTier.TRIAL,
      trialStartedAt: Date.now(),
      hasCompletedOnboarding: true,
      subscriptionStatus: undefined,
      xp: 0,
      level: 1,
      badges: [],
      streakFreezes: 0,
      aiPersona: 'zen'
    };
    users.push(newUser);
    localStorage.setItem(keys.USERS, JSON.stringify(users));
    localStorage.setItem(keys.ACTIVE_USER_ID, newUser.id);
    return newUser;
  },

  login: (email: string): User | null => {
     // Local fallback login
    const keys = getKeys();
    const user = storageService.getUsers().find(u => u.email === email);
    if (user) localStorage.setItem(keys.ACTIVE_USER_ID, user.id);
    return user || null;
  },

  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(getKeys().ACTIVE_USER_ID);
  },
  
  getActiveUser: (): User | null => {
    // Synchronous getter for initial render from local storage
    const keys = getKeys();
    const id = localStorage.getItem(keys.ACTIVE_USER_ID);
    return storageService.getUsers().find(u => u.id === id) || null;
  },

  // --- ASYNC DATA METHODS ---

  getGoals: async (userId: string): Promise<Goal[]> => {
    const session = await supabase.auth.getSession();
    
    // 1. SUPABASE MODE
    if (session.data.session?.user) {
         const { data, error } = await supabase
          .from('goals')
          .select(`*, daily_tasks(*), task_completions(*), checkpoints(*)`)
          .eq('user_id', session.data.session.user.id);
         
         if (error) {
             console.error("Supabase Error:", error);
             return [];
         }
         return data.map(g => {
             const goal = mapGoalFromDB(g);
             return calculateGoalProgressLocal(goal); // Recalculate progress client-side to be sure
         });
    }

    // 2. LOCALSTORAGE MODE
    const keys = getKeys();
    const all: Goal[] = JSON.parse(localStorage.getItem(keys.GOALS) || '[]');
    return all
      .filter(g => g.userId === userId)
      .map(g => {
        const withProgress = calculateGoalProgressLocal(g);
        return {
           ...withProgress,
           aiHistory: g.aiHistory || [],
           plannedCheckpoints: generateMilestones(g.startDate, g.targetDate)
        };
      });
  },

  saveGoal: async (goal: Omit<Goal, 'id' | 'createdAt' | 'progress' | 'plannedCheckpoints' | 'streak'> & { createdAt?: number, streak?: number }): Promise<Goal> => {
    const session = await supabase.auth.getSession();

    // 1. SUPABASE MODE
    if (session.data.session?.user) {
        // Insert Goal
        const { data: goalData, error } = await supabase.from('goals').insert({
            user_id: session.data.session.user.id,
            title: goal.title,
            description: goal.description,
            category: goal.category,
            start_date: goal.startDate,
            target_date: goal.targetDate,
            image: goal.image,
            created_at: goal.createdAt || Date.now(),
            progress: 0,
            streak: 0,
            ai_history: []
        }).select().single();

        if (error) throw error;

        // Insert Tasks
        if (goal.dailyTasks.length > 0) {
            const tasks = goal.dailyTasks.map(t => ({
                goal_id: goalData.id,
                title: t.title,
                days_of_week: t.daysOfWeek
            }));
            await supabase.from('daily_tasks').insert(tasks);
        }

        // Return constructed object (fetch again to be safe or construct manually)
        return storageService.getGoals(goalData.user_id).then(goals => goals.find(g => g.id === goalData.id)!);
    }

    // 2. LOCALSTORAGE MODE
    const keys = getKeys();
    const all = JSON.parse(localStorage.getItem(keys.GOALS) || '[]');
    const milestones = generateMilestones(goal.startDate, goal.targetDate);
    const newGoal: Goal = {
      ...goal,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: goal.createdAt || Date.now(),
      progress: 0,
      streak: goal.streak || 0,
      plannedCheckpoints: milestones,
      aiHistory: []
    };
    all.push(newGoal);
    localStorage.setItem(keys.GOALS, JSON.stringify(all));
    return newGoal;
  },

  updateGoal: async (goal: Goal): Promise<Goal> => {
    const session = await supabase.auth.getSession();

    // 1. SUPABASE MODE
    if (session.data.session?.user) {
        await supabase.from('goals').update({
            title: goal.title,
            description: goal.description,
            image: goal.image,
            target_date: goal.targetDate,
            ai_history: goal.aiHistory
        }).eq('id', goal.id);
        
        // Note: Updating tasks is complex (diffing). 
        // For this demo, we assume tasks aren't heavily edited after creation in the DB mode 
        // or would require a 'delete all and re-insert' strategy for simplicity.
        // Let's rely on getGoals re-calculating everything.
        const recalculated = calculateGoalProgressLocal(goal);
        return recalculated;
    }

    // 2. LOCALSTORAGE MODE
    const keys = getKeys();
    const all: Goal[] = JSON.parse(localStorage.getItem(keys.GOALS) || '[]');
    const idx = all.findIndex(g => g.id === goal.id);
    if (idx !== -1) {
      const milestones = generateMilestones(goal.startDate, goal.targetDate);
      all[idx] = { ...goal, plannedCheckpoints: milestones };
      localStorage.setItem(keys.GOALS, JSON.stringify(all));
      return calculateGoalProgressLocal(all[idx]);
    }
    return goal;
  },

  deleteGoal: async (id: string) => {
    const session = await supabase.auth.getSession();
    if (session.data.session?.user) {
        await supabase.from('goals').delete().eq('id', id);
        return;
    }

    const keys = getKeys();
    const all: Goal[] = JSON.parse(localStorage.getItem(keys.GOALS) || '[]');
    const filtered = all.filter(g => g.id !== id);
    localStorage.setItem(keys.GOALS, JSON.stringify(filtered));
  },

  toggleTask: async (goalId: string, taskId: string, date: string): Promise<Goal | null> => {
    const session = await supabase.auth.getSession();

    // 1. SUPABASE MODE
    if (session.data.session?.user) {
        // Check if exists
        const { data: existing } = await supabase
            .from('task_completions')
            .select('*')
            .eq('task_id', taskId)
            .eq('date', date)
            .single();

        if (existing) {
            await supabase.from('task_completions').delete().eq('id', existing.id);
        } else {
            await supabase.from('task_completions').insert({
                goal_id: goalId,
                task_id: taskId,
                date: date
            });
        }
        
        // Re-fetch full goal to get updated progress
        const goals = await storageService.getGoals(session.data.session.user.id);
        return goals.find(g => g.id === goalId) || null;
    }

    // 2. LOCALSTORAGE MODE
    const keys = getKeys();
    const all: Goal[] = JSON.parse(localStorage.getItem(keys.GOALS) || '[]');
    const idx = all.findIndex(g => g.id === goalId);
    if (idx === -1) return null;

    const goal = all[idx];
    const existingIdx = goal.completions.findIndex(c => c.date === date && c.taskId === taskId);
    if (existingIdx > -1) {
      goal.completions.splice(existingIdx, 1);
    } else {
      goal.completions.push({ date, taskId });
    }

    localStorage.setItem(keys.GOALS, JSON.stringify(all));
    return calculateGoalProgressLocal(goal);
  },

  addCheckpoint: async (goalId: string, checkpoint: Omit<Checkpoint, 'id'>): Promise<Goal | null> => {
    const session = await supabase.auth.getSession();

    if (session.data.session?.user) {
        await supabase.from('checkpoints').insert({
            goal_id: goalId,
            date: checkpoint.date,
            value: checkpoint.value,
            note: checkpoint.note,
            manual_progress_adjustment: checkpoint.manualProgressAdjustment
        });
        
        const goals = await storageService.getGoals(session.data.session.user.id);
        return goals.find(g => g.id === goalId) || null;
    }

    const keys = getKeys();
    const all: Goal[] = JSON.parse(localStorage.getItem(keys.GOALS) || '[]');
    const idx = all.findIndex(g => g.id === goalId);
    if (idx === -1) return null;

    all[idx].checkpoints.push({ ...checkpoint, id: Math.random().toString(36).substr(2, 9) });
    localStorage.setItem(keys.GOALS, JSON.stringify(all));
    return calculateGoalProgressLocal(all[idx]);
  },

  // --- USER DATA SYNC ---
  updateUser: async (updatedUser: User): Promise<User> => {
      const session = await supabase.auth.getSession();

      if (session.data.session?.user && updatedUser.id === session.data.session.user.id) {
          // Sync profile to Supabase
          const { error } = await supabase.from('profiles').update({
              name: updatedUser.name,
              xp: updatedUser.xp,
              level: updatedUser.level,
              badges: updatedUser.badges,
              tier: updatedUser.tier,
              stripe_customer_id: updatedUser.stripeCustomerId,
              subscription_status: updatedUser.subscriptionStatus
          }).eq('id', updatedUser.id);
          
          if (error) console.error("Profile sync error", error);
      }

      // Always update local for fast read
      const keys = getKeys();
      const users = storageService.getUsers();
      const idx = users.findIndex(u => u.id === updatedUser.id);
      if (idx !== -1) {
        users[idx] = updatedUser;
        localStorage.setItem(keys.USERS, JSON.stringify(users));
      }
      return updatedUser;
  },

  // Read-only helpers for analytics that don't need DB writes directly
  getDailyProgress: (goals: Goal[], currentDate: Date): number => storageService.getDailyProgressSync(goals, currentDate),
  getOverallAverageDailyProgress: (goals: Goal[], currentDate: Date): number => storageService.getOverallAverageDailyProgressSync(goals, currentDate),
  getGlobalPerfectDayStreak: (goals: Goal[], currentDate: Date): number => storageService.getGlobalPerfectDayStreakSync(goals, currentDate),
  getLast7DaysStats: (goal: Goal, currentDate: Date) => storageService.getLast7DaysStatsSync(goal, currentDate),
  
  // Internal sync implementations (moved from old object)
  getDailyProgressSync: (goals: Goal[], currentDate: Date): number => {
     const dateStr = currentDate.toISOString().split('T')[0];
     const dayOfWeek = currentDate.getUTCDay() === 0 ? 7 : currentDate.getUTCDay();
     let scheduled = 0;
     let completed = 0;

     goals.forEach(g => {
         if (dateStr >= g.startDate && dateStr <= g.targetDate) {
             const daysTasks = g.dailyTasks.filter(t => t.daysOfWeek.includes(dayOfWeek));
             scheduled += daysTasks.length;
             daysTasks.forEach(t => {
                 if (g.completions.some(c => c.date === dateStr && c.taskId === t.id)) completed++;
             });
         }
     });
     return scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100);
  },

  getOverallAverageDailyProgressSync: (goals: Goal[], currentDate: Date): number => {
     if (goals.length === 0) return 0;
     const totalProgress = goals.reduce((sum, goal) => sum + goal.progress, 0);
     return Math.round(totalProgress / goals.length);
  },
  
  getGlobalPerfectDayStreakSync: (goals: Goal[], currentDate: Date): number => {
    if (goals.length === 0) return 0;
    let streak = 0;
    let checkDate = new Date(currentDate);
    checkDate.setDate(checkDate.getDate() - 1); 
    
    for (let i = 0; i < 365; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        let totalScheduledForDay = 0;
        let totalCompletedForDay = 0;
        let hasActiveGoals = false;

        goals.forEach(g => {
            if (dateStr >= g.startDate && dateStr <= g.targetDate) {
                const dayOfWeek = checkDate.getUTCDay() === 0 ? 7 : checkDate.getUTCDay();
                const daysTasks = g.dailyTasks.filter(t => t.daysOfWeek.includes(dayOfWeek));
                if (daysTasks.length > 0) {
                    hasActiveGoals = true;
                    totalScheduledForDay += daysTasks.length;
                    daysTasks.forEach(t => {
                        if (g.completions.some(c => c.date === dateStr && c.taskId === t.id)) totalCompletedForDay++;
                    });
                }
            }
        });

        if (totalScheduledForDay > 0) {
            if (totalCompletedForDay === totalScheduledForDay) streak++;
            else break;
        } else if (!hasActiveGoals) {
            if (streak > 0) break;
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
  },

  getLast7DaysStatsSync: (goal: Goal, currentDate: Date) => {
      const stats = [];
      const ptr = new Date(currentDate);
      for(let i=0; i<7; i++) {
          const dStr = ptr.toISOString().split('T')[0];
          const dw = ptr.getUTCDay() === 0 ? 7 : ptr.getUTCDay();
          const tasks = goal.dailyTasks.filter(t => t.daysOfWeek.includes(dw));
          let percentage = 0;
          if (tasks.length > 0) {
              const comp = tasks.filter(t => goal.completions.some(c => c.date === dStr && c.taskId === t.id)).length;
              percentage = Math.round((comp / tasks.length) * 100);
          }
          stats.unshift({ day: ptr.toLocaleDateString('cs-CZ', { weekday: 'short' }), percentage });
          ptr.setDate(ptr.getDate() - 1);
      }
      return stats;
  },
  
  upgradeToPremium: (userId: string) => {
    // Only local update logic kept for simplicity, in real app this is handled via Stripe Webhook -> Supabase
    const keys = getKeys();
    const users = storageService.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx].tier = UserTier.PREMIUM;
      users[idx].subscriptionStatus = 'active';
      localStorage.setItem(keys.USERS, JSON.stringify(users));
      
      // Try sync if online
      storageService.updateUser(users[idx]);
      return users[idx];
    }
    return null;
  },

  cancelSubscription: (userId: string) => {
    const keys = getKeys();
    const users = storageService.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx].subscriptionStatus = 'canceled';
      localStorage.setItem(keys.USERS, JSON.stringify(users));
       // Try sync if online
      storageService.updateUser(users[idx]);
      return users[idx];
    }
    return null;
  }
};
