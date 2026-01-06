
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Goal, UserTier, DailyTask, Badge } from './types';
import { storageService } from './services/storageService';
import { gamificationService, XP_REWARDS } from './services/gamificationService';
import { getDailyBriefing, getAICoachingAdvice } from './services/aiService';
import { CATEGORIES, TRIAL_MAX_GOALS, BADGES_DEFINITIONS } from './constants';
import GoalCard from './components/GoalCard';
import PremiumModal from './components/PremiumModal';
import UserProfileModal from './components/UserProfileModal';
import SimulationPanel from './components/SimulationPanel';
import { useTime } from './contexts/TimeContext';
import { useSettings } from './contexts/SettingsContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { supabase } from './lib/supabase';

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 max-w-[200px]">
        <div className="text-xs font-bold text-gray-400 mb-1">{label}</div>
        <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mb-2">
            {payload[0].value} {typeof payload[0].value === 'number' && payload[0].value <= 100 && payload[0].value >= 0 && data.originalText?.includes('%') ? '%' : ''}
        </div>
        {data.note && (
            <div className="text-xs text-gray-600 dark:text-gray-300 italic border-t border-gray-100 dark:border-slate-600 pt-2 mt-1">
               "{data.note}"
            </div>
        )}
      </div>
    );
  }
  return null;
};

const App: React.FC = () => {
  const { currentDate } = useTime(); 
  const { t, isDarkMode, toggleDarkMode, language, setLanguage, isDevMode } = useSettings();
  
  const [user, setUser] = useState<User | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
  const [showSuccessPayment, setShowSuccessPayment] = useState(false);
  
  // Gamification States
  const [levelUpModal, setLevelUpModal] = useState<number | null>(null);
  const [newBadgeModal, setNewBadgeModal] = useState<Badge | null>(null);
  
  // AI States
  const [dailyBriefing, setDailyBriefing] = useState<string | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAiAdviceLoading, setIsAiAdviceLoading] = useState(false);
  
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', category: 'health', targetDate: '' });
  const [goalImage, setGoalImage] = useState<string | undefined>(undefined);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [taskDays, setTaskDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [checkpointForm, setCheckpointForm] = useState({ value: '', note: '', manualProgress: '' });
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const dailyProgress = useMemo(() => storageService.getDailyProgress(goals, currentDate), [goals, currentDate]);
  const averageDailyProgress = useMemo(() => storageService.getOverallAverageDailyProgress(goals, currentDate), [goals, currentDate]);
  const perfectDayStreak = useMemo(() => storageService.getGlobalPerfectDayStreak(goals, currentDate), [goals, currentDate]);

  const daysLabels = useMemo(() => t('days_short') as string[], [language]);

  // SUPABASE AUTH LISTENER & DATA LOADING
  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
         handleSupabaseUser(session.user);
      } else {
         const local = storageService.getActiveUser();
         if (local) {
             setUser(local);
             refreshGoals(local.id);
         }
      }
    });

    // 2. Auth State Change Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        handleSupabaseUser(session.user);
        setIsAuthModalOpen(false);
      } else {
        if (user && !storageService.getActiveUser()) {
           setUser(null);
           setGoals([]);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSupabaseUser = async (sbUser: any) => {
     let localUser = storageService.getUsers().find(u => u.id === sbUser.id);
     
     if (!localUser) {
        localUser = storageService.register(sbUser.email!, sbUser.email!.split('@')[0], sbUser.id);
     }
     
     setUser(localUser);
     await refreshGoals(localUser.id);
  };

  const refreshGoals = async (userId: string) => {
      const loadedGoals = await storageService.getGoals(userId);
      setGoals(loadedGoals);
  };

  // AI BRIEFING EFFECT
  useEffect(() => {
    const fetchBriefing = async () => {
        if (!user || goals.length === 0) return;
        
        // Simple caching strategy: if we already have briefing for this session, don't refetch
        if (dailyBriefing) return;

        setIsBriefingLoading(true);
        try {
            const goalsSummary = goals.map(g => `${g.title} (Progress: ${g.progress}%, Streak: ${g.streak})`).join(', ');
            const briefing = await getDailyBriefing(user.name, goalsSummary, user.aiPersona);
            setDailyBriefing(briefing);
        } catch (e) {
            console.error("Failed to fetch briefing", e);
        } finally {
            setIsBriefingLoading(false);
        }
    };

    fetchBriefing();
  }, [user?.id, goals.length]); // Re-run only if user changes or goal count changes significantly

  // PAYMENT CHECK LOGIC
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('payment_success') === 'true') {
        const currentUser = storageService.getActiveUser();
        if (currentUser) {
            const upgradedUser = storageService.upgradeToPremium(currentUser.id);
            setUser(upgradedUser);
            setShowSuccessPayment(true);
            window.history.replaceState({}, document.title, "/");
        }
    }
  }, []);

  useEffect(() => {
    if (!editingGoalId && isGoalModalOpen && newGoal.category && dailyTasks.length === 0) {
       const suggestions = t(`category_suggestions.${newGoal.category}`);
       if (Array.isArray(suggestions)) {
          setDailyTasks(suggestions.map((s: string) => ({ 
            id: Math.random().toString(36).substr(2, 5), 
            title: s,
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7] 
          })));
       }
    }
  }, [newGoal.category, isGoalModalOpen, editingGoalId, language]);

  const milestoneChartData = useMemo(() => {
    if (!selectedGoal || !selectedGoal.checkpoints) return [];
    
    return selectedGoal.checkpoints
      .map(cp => {
         const match = cp.value.match(/-?\d+(\.\d+)?/);
         const parsedVal = match ? parseFloat(match[0]) : NaN;
         const val = !isNaN(parsedVal) ? parsedVal : (cp.manualProgressAdjustment ?? null);

         return {
            date: new Date(cp.date).toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'numeric' }),
            fullDate: cp.date,
            value: val,
            originalText: cp.value,
            note: cp.note 
         };
      })
      .filter(item => item.value !== null)
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  }, [selectedGoal, language]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
          data: { name: email.split('@')[0] } // Metadata for trigger
        }
      });

      if (error) {
        alert(error.message);
      } else {
        setMagicLinkSent(true);
      }
    } catch (err) {
      console.error(err);
      alert("Supabase credentials missing or invalid. Check console. Logging in as demo user locally.");
      let loggedUser = storageService.login(email) || storageService.register(email, email.split('@')[0]);
      setUser(loggedUser);
      await refreshGoals(loggedUser.id);
      setIsAuthModalOpen(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
     await storageService.logout();
     setUser(null);
     setGoals([]);
     setDailyBriefing(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setGoalImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setGoalImage(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const quickDates = useMemo(() => {
    const today = new Date(currentDate); 
    return [
      { label: t('quick_dates.month'), date: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0] },
      { label: t('quick_dates.three_months'), date: new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()).toISOString().split('T')[0] },
      { label: t('quick_dates.eoy'), date: new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0] },
    ];
  }, [currentDate, language]);

  const handleOpenCreateGoal = () => {
    if (!user) return;
    if (user.tier === UserTier.TRIAL && goals.length >= TRIAL_MAX_GOALS) {
      setIsPremiumModalOpen(true);
      return;
    }
    resetGoalForm();
    setIsGoalModalOpen(true);
  };

  const handleAddGoal = async () => {
    const errors: string[] = [];
    if (!user) errors.push('User not logged in.');
    if (!newGoal.title.trim()) errors.push('Title is required.');
    if (!newGoal.targetDate) errors.push('Target date is required.');
    
    const todayStr = currentDate.toISOString().split('T')[0];
    if (newGoal.targetDate && newGoal.targetDate < todayStr) {
        errors.push('Target date cannot be in the past.');
    }

    if (errors.length > 0) {
        setFormErrors(errors);
        return;
    }

    if (editingGoalId) {
      const existing = goals.find(g => g.id === editingGoalId);
      if (existing) {
        const updated: Goal = { ...existing, ...newGoal, dailyTasks: [...dailyTasks], image: goalImage };
        const saved = await storageService.updateGoal(updated);
        setGoals(prev => prev.map(g => g.id === saved.id ? saved : g));
      }
    } else {
      const saved = await storageService.saveGoal({
        userId: user!.id,
        ...newGoal,
        startDate: currentDate.toISOString().split('T')[0],
        createdAt: currentDate.getTime(),
        dailyTasks: [...dailyTasks],
        completions: [],
        checkpoints: [],
        streak: 0,
        image: goalImage,
        aiHistory: []
      });
      setGoals(prev => [...prev, saved]);
    }
    resetGoalForm();
    setIsGoalModalOpen(false);
  };

  const resetGoalForm = () => {
    setEditingGoalId(null);
    setNewGoal({ title: '', description: '', category: 'health', targetDate: '' });
    setGoalImage(undefined);
    setDailyTasks([]);
    setTaskInput('');
    setTaskDays([1, 2, 3, 4, 5, 6, 7]);
    setFormErrors([]);
  };

  const addNewTask = () => {
    if (!taskInput.trim()) return;
    const newTask: DailyTask = {
      id: Math.random().toString(36).substr(2, 5),
      title: taskInput,
      daysOfWeek: [...taskDays]
    };
    setDailyTasks(prev => [...prev, newTask]);
    setTaskInput('');
  };

  const toggleDay = (day: number) => {
    setTaskDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day]
    );
  };

  const toggleExistingTaskDay = (taskId: string, day: number) => {
    setDailyTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        const newDays = t.daysOfWeek.includes(day) 
            ? t.daysOfWeek.filter(d => d !== day) 
            : [...t.daysOfWeek, day];
        newDays.sort((a, b) => a - b);
        return { ...t, daysOfWeek: newDays };
    }));
  };

  const handleStartEdit = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setNewGoal({ title: goal.title, description: goal.description, category: goal.category, targetDate: goal.targetDate });
    setGoalImage(goal.image);
    setDailyTasks([...goal.dailyTasks]);
    setIsGoalModalOpen(true);
  };

  const handleToggleTask = async (goalId: string, taskId: string) => {
    if (!user) return;
    const today = currentDate.toISOString().split('T')[0];
    const goal = goals.find(g => g.id === goalId);
    
    const isAlreadyCompleted = goal?.completions.some(c => c.date === today && c.taskId === taskId);
    
    // Optimistic UI update
    setGoals(prev => prev.map(g => {
        if (g.id !== goalId) return g;
        const newCompletions = isAlreadyCompleted 
            ? g.completions.filter(c => !(c.date === today && c.taskId === taskId))
            : [...g.completions, { date: today, taskId }];
        return { ...g, completions: newCompletions };
    }));

    const updatedGoal = await storageService.toggleTask(goalId, taskId, today);
    if (!updatedGoal) {
        await refreshGoals(user.id);
        return;
    }

    setGoals(prev => prev.map(g => g.id === goalId ? updatedGoal : g));
    
    if (!isAlreadyCompleted) {
        let totalXp = XP_REWARDS.TASK_COMPLETION;
        
        const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay();
        const todaysTasks = updatedGoal.dailyTasks.filter(t => t.daysOfWeek.includes(dayOfWeek));
        const completedToday = todaysTasks.filter(t => updatedGoal.completions.some(c => c.date === today && c.taskId === t.id));

        if (todaysTasks.length > 0 && completedToday.length === todaysTasks.length) {
            totalXp += XP_REWARDS.GOAL_DAILY_COMPLETE;
        }

        const { user: xpUser, leveledUp } = gamificationService.addXp(user, totalXp);
        const { user: finalUser, newBadges } = gamificationService.checkForBadges(xpUser, goals, 'task', { perfectStreak: perfectDayStreak });
        
        await storageService.updateUser(finalUser);
        setUser(finalUser);
        
        if (leveledUp) setLevelUpModal(finalUser.level);
        if (newBadges.length > 0) setNewBadgeModal(newBadges[0]);
    }
  };

  const handleRequestDelete = (id: string) => {
    setGoalToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (goalToDelete) {
      await storageService.deleteGoal(goalToDelete);
      setGoals(prev => prev.filter(g => g.id !== goalToDelete));
      setIsDeleteModalOpen(false);
      setGoalToDelete(null);
    }
  };

  const handleAddCheckpoint = async () => {
    if (!selectedGoal || !user) return;
    const updated = await storageService.addCheckpoint(selectedGoal.id, {
      date: currentDate.toISOString().split('T')[0],
      value: checkpointForm.value,
      note: checkpointForm.note,
      manualProgressAdjustment: checkpointForm.manualProgress ? parseInt(checkpointForm.manualProgress) : undefined
    });
    if (updated) {
      setGoals(prev => prev.map(g => g.id === selectedGoal.id ? updated : g));
      
      const { user: xpUser, leveledUp } = gamificationService.addXp(user, XP_REWARDS.MILESTONE_ENTRY);
      const { user: finalUser, newBadges } = gamificationService.checkForBadges(xpUser, goals, 'milestone');
      await storageService.updateUser(finalUser);
      setUser(finalUser);
      if (leveledUp) setLevelUpModal(finalUser.level);
      if (newBadges.length > 0) setNewBadgeModal(newBadges[0]);

      setIsCheckpointModalOpen(false);
      setSelectedGoal(null);
      setCheckpointForm({ value: '', note: '', manualProgress: '' });
    }
  };

  const handleOpenAnalytics = (g: Goal) => {
      setSelectedGoal(g);
      setAiAdvice(null); // Reset advice when opening new goal
      setIsAnalyticsOpen(true);
  };
  
  const handleGetAiAdvice = async () => {
      if (!selectedGoal || !user) return;
      setIsAiAdviceLoading(true);
      try {
          const context = `Poslední milník: ${selectedGoal.checkpoints.length > 0 ? selectedGoal.checkpoints[selectedGoal.checkpoints.length - 1].value : 'Žádný'}. Streak: ${selectedGoal.streak} dní.`;
          const advice = await getAICoachingAdvice(selectedGoal.title, selectedGoal.progress, context, user.aiPersona);
          setAiAdvice(advice);
      } catch (e) {
          console.error("AI fetch failed", e);
          setAiAdvice("Failed to contact your coach. Try again later.");
      } finally {
          setIsAiAdviceLoading(false);
      }
  };

  const handleUpdateUserProfile = async (u: User) => {
     const updated = await storageService.updateUser(u);
     setUser(updated);
     // If persona changed, clear briefing so it fetches new one next time or reload
     if (updated.aiPersona !== user?.aiPersona) {
         setDailyBriefing(null);
     }
  };

  return (
    <div className={`min-h-screen bg-[#FBFBFE] dark:bg-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900 transition-colors duration-300`}>
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 px-8 py-5 flex items-center justify-between sticky top-0 z-[60]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg animate-float">
            <i className="fa-solid fa-rocket"></i>
          </div>
          <span className="font-black text-2xl text-gray-900 dark:text-white tracking-tight">{t('app_name')}</span>
        </div>
        
        <div className="flex items-center gap-4">
             {/* SETTINGS TOGGLES */}
             <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                 <button onClick={() => setLanguage('en')} className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${language === 'en' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-gray-400'}`}>EN</button>
                 <button onClick={() => setLanguage('cs')} className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${language === 'cs' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-gray-400'}`}>CS</button>
             </div>
             <button onClick={toggleDarkMode} className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-yellow-400 flex items-center justify-center transition-colors">
                <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
             </button>

            {user ? (
              <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <div className="text-right">
                        <div className="text-[10px] font-black uppercase text-indigo-400">{t('level')} {user.level || 1}</div>
                        <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200">{user.xp || 0} XP</div>
                    </div>
                    <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-indigo-600 border border-indigo-100 dark:border-indigo-900 shadow-sm relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 w-full bg-indigo-100 dark:bg-indigo-700 transition-all duration-1000" style={{height: `${((user.xp % 200) / 200) * 100}%`}}></div>
                        <i className="fa-solid fa-trophy relative z-10"></i>
                    </div>
                </div>

                <div onClick={() => setIsProfileModalOpen(true)} className="text-right hidden sm:block cursor-pointer hover:opacity-70 transition-opacity">
                  <div className="text-sm font-black text-gray-900 dark:text-white flex items-center justify-end gap-2">
                     {user.name} <i className="fa-solid fa-gear text-gray-300 text-xs"></i>
                  </div>
                  <div className="text-[10px] uppercase font-black text-indigo-500 tracking-widest">{user.tier}</div>
                </div>
                <button onClick={handleLogout} className="w-11 h-11 rounded-2xl bg-gray-50 dark:bg-slate-800 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center">
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>
              </div>
            ) : (
              <button onClick={() => { setIsAuthModalOpen(true); setMagicLinkSent(false); }} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl">
                {t('login')}
              </button>
            )}
        </div>
      </nav>

      <main className="max-w-7xl w-full mx-auto p-8 flex-1 pb-24">
        {user ? (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* --- AI BRIEFING SECTION --- */}
            {dailyBriefing && (
                <div className={`p-6 rounded-[2rem] shadow-lg flex items-start gap-4 animate-in slide-in-from-top duration-700 ${
                    user.aiPersona === 'drill' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
                    user.aiPersona === 'analytic' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' :
                    'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                }`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl ${
                        user.aiPersona === 'drill' ? 'bg-red-100 text-red-600' :
                        user.aiPersona === 'analytic' ? 'bg-blue-100 text-blue-600' :
                        'bg-emerald-100 text-emerald-600'
                    }`}>
                        <i className={`fa-solid ${
                            user.aiPersona === 'drill' ? 'fa-dumbbell' :
                            user.aiPersona === 'analytic' ? 'fa-chart-pie' :
                            'fa-leaf'
                        }`}></i>
                    </div>
                    <div>
                        <div className={`text-xs font-black uppercase tracking-widest mb-1 ${
                            user.aiPersona === 'drill' ? 'text-red-800 dark:text-red-300' :
                            user.aiPersona === 'analytic' ? 'text-blue-800 dark:text-blue-300' :
                            'text-emerald-800 dark:text-emerald-300'
                        }`}>Daily Briefing</div>
                        <p className={`font-medium ${
                             user.aiPersona === 'drill' ? 'text-red-900 dark:text-red-100 font-black' :
                             user.aiPersona === 'analytic' ? 'text-blue-900 dark:text-blue-100 font-mono text-sm' :
                             'text-emerald-900 dark:text-emerald-100 italic'
                        }`}>{dailyBriefing}</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">{t('my_journey')} 2025</h1>
                <p className="text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">{t('subtitle')}</p>
              </div>
              <button onClick={handleOpenCreateGoal} className="bg-indigo-600 text-white px-10 py-4 rounded-[1.5rem] font-black shadow-2xl hover:scale-105 transition-all flex items-center gap-3">
                <i className="fa-solid fa-plus text-lg"></i>
                <span>{t('add_goal')}</span>
              </button>
            </div>

            {user.tier === UserTier.TRIAL && (
              <div className="bg-gradient-to-r from-amber-200 to-amber-300 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl border border-amber-200 relative overflow-hidden">
                 <div className="flex items-center gap-5 relative z-10">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl text-amber-500 shadow-md">
                       <i className="fa-solid fa-crown"></i>
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-amber-900 mb-1">{t('premium_modal_title')} 🚀</h3>
                       <p className="text-amber-800/80 font-bold text-sm">Free limit: {TRIAL_MAX_GOALS} goal. Go Premium for unlimited.</p>
                    </div>
                 </div>
                 <button onClick={() => setIsPremiumModalOpen(true)} className="bg-white text-amber-900 px-8 py-4 rounded-xl font-black shadow-lg hover:scale-105 transition-all relative z-10">
                   {t('premium_upgrade')}
                 </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm flex items-center gap-6 group hover:shadow-lg transition-all">
                <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-3xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform"><i className="fa-solid fa-fire"></i></div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('streak')}</div>
                  <div className="text-3xl font-black text-gray-900 dark:text-white">{perfectDayStreak}</div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm flex items-center gap-6 group hover:shadow-lg transition-all">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform"><i className="fa-solid fa-bullseye"></i></div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('active_goals')}</div>
                  <div className="text-3xl font-black text-gray-900 dark:text-white">{goals.length}</div>
                </div>
              </div>
              <div className={`p-8 rounded-[2.5rem] shadow-xl flex items-center gap-6 text-white transition-all group hover:scale-[1.02] ${dailyProgress === 100 ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-indigo-600'}`}>
                <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-2xl group-hover:rotate-12 transition-transform"><i className="fa-solid fa-check-double"></i></div>
                <div className="flex-1">
                  <div className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">{t('today_progress')}</div>
                  <div className="text-3xl font-black">
                    {dailyProgress}% <span className="text-white/40 text-xl font-medium">/ {averageDailyProgress}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {goals.length > 0 ? goals.map((goal, idx) => (
                <div key={goal.id} style={{ animationDelay: `${idx * 100}ms` }} className="animate-in fade-in slide-in-from-bottom-8 fill-mode-backwards">
                    <GoalCard 
                      goal={goal} 
                      currentDate={currentDate}
                      onToggleTask={handleToggleTask}
                      onUpdate={() => { 
                        setSelectedGoal(goal); 
                        setCheckpointForm({
                          value: '',
                          note: '',
                          manualProgress: goal.progress.toString()
                        });
                        setIsCheckpointModalOpen(true); 
                      }}
                      onEdit={handleStartEdit}
                      onDelete={handleRequestDelete}
                      onViewAnalytics={handleOpenAnalytics}
                      isPremium={user.tier === UserTier.PREMIUM}
                    />
                </div>
              )) : (
                <div className="col-span-full py-24 text-center bg-white dark:bg-slate-800 rounded-[3rem] border-4 border-dashed border-gray-50 dark:border-slate-700">
                  <i className="fa-solid fa-seedling text-7xl text-gray-200 dark:text-slate-600 mb-8 animate-bounce"></i>
                  <h3 className="text-2xl font-black text-gray-400 mb-4">{t('no_goals')}</h3>
                  <button onClick={handleOpenCreateGoal} className="text-indigo-600 dark:text-indigo-400 font-black hover:underline">{t('add_goal')}</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-32 text-center max-w-2xl mx-auto">
            <h1 className="text-7xl font-black text-gray-900 dark:text-white leading-tight mb-8">{t('hero_title')}<br/><span className="text-indigo-600 dark:text-indigo-400">{t('hero_highlight')}</span></h1>
            <p className="text-xl text-gray-500 dark:text-slate-400 mb-12 font-medium">{t('hero_desc')}</p>
            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                <button onClick={() => { setIsAuthModalOpen(true); setMagicLinkSent(false); }} className="bg-indigo-600 text-white px-12 py-6 rounded-[2rem] font-black text-2xl shadow-2xl shadow-indigo-100 hover:scale-105 transition-all active:scale-95">{t('start_journey')}</button>
            </div>
          </div>
        )}
      </main>

      {/* Payment Success Modal */}
      {showSuccessPayment && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowSuccessPayment(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-12 text-center max-w-md w-full animate-in zoom-in-50 duration-500 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800 -z-10"></div>
                  <div className="w-24 h-24 mx-auto mb-6 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center text-4xl text-emerald-600 dark:text-emerald-400 shadow-xl">
                      <i className="fa-solid fa-check"></i>
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Premium Activated!</h2>
                  <button onClick={() => setShowSuccessPayment(false)} className="bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-transform">Let's go!</button>
              </div>
          </div>
      )}

      {/* --- LEVEL UP MODAL --- */}
      {levelUpModal && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setLevelUpModal(null)}>
              <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-12 text-center max-w-md w-full animate-in zoom-in-50 duration-500 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800 -z-10"></div>
                  <div className="w-32 h-32 mx-auto mb-6 bg-yellow-400 rounded-full flex items-center justify-center text-6xl text-white shadow-2xl shadow-yellow-200 animate-bounce">
                      <i className="fa-solid fa-star"></i>
                  </div>
                  <h2 className="text-4xl font-black text-indigo-900 dark:text-white mb-2">Level Up!</h2>
                  <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-8">{t('level')} {levelUpModal}</p>
                  <button onClick={() => setLevelUpModal(null)} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-transform">OK</button>
              </div>
          </div>
      )}

      {/* --- NEW BADGE MODAL --- */}
      {newBadgeModal && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setNewBadgeModal(null)}>
              <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-12 text-center max-w-md w-full animate-in zoom-in-50 duration-500" onClick={e => e.stopPropagation()}>
                   <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-amber-300 to-amber-500 rounded-3xl flex items-center justify-center text-4xl text-white shadow-xl rotate-12">
                      <i className={`fa-solid ${BADGES_DEFINITIONS.find(b => b.id === newBadgeModal.id)?.icon}`}></i>
                   </div>
                   <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">New Badge!</h2>
                   <div className="text-lg font-bold text-amber-600 mb-2">{t(`badges.${newBadgeModal.id}.label`)}</div>
                   <button onClick={() => setNewBadgeModal(null)} className="bg-amber-500 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-transform">Awesome!</button>
              </div>
          </div>
      )}


      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
           <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-sm p-8 shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{t('confirm_delete_title')}</h3>
              <p className="text-gray-500 dark:text-slate-400 font-medium mb-8 text-sm">{t('confirm_delete_msg')}</p>
              <div className="flex gap-3">
                 <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 bg-gray-100 dark:bg-slate-700 dark:text-white py-3 rounded-xl font-black">{t('cancel')}</button>
                 <button onClick={handleConfirmDelete} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-black">{t('delete')}</button>
              </div>
           </div>
        </div>
      )}

      {isGoalModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-3xl p-8 shadow-2xl m-auto animate-in zoom-in relative">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-4xl font-black text-gray-900 dark:text-white">{editingGoalId ? t('goal_title') : t('add_goal')}</h2>
              <button onClick={() => {setIsGoalModalOpen(false); resetGoalForm();}} className="w-12 h-12 rounded-full bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="col-span-full">
                   <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">{t('visual_motivation')}</label>
                   <div onClick={() => fileInputRef.current?.click()} className="w-full h-48 bg-gray-50 dark:bg-slate-700 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-600 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group">
                    {goalImage ? (
                      <>
                        <img src={goalImage} className="w-full h-full object-cover" />
                        <button 
                           onClick={handleRemoveImage}
                           className="absolute top-2 right-2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-white transition-colors shadow-md z-10"
                        >
                           <i className="fa-solid fa-xmark"></i>
                        </button>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-image text-4xl text-gray-200 dark:text-slate-500 mb-2"></i>
                        <span className="text-sm font-bold text-gray-400 dark:text-slate-500">{t('upload_image')}</span>
                      </>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                   </div>
                </div>

                <div className="col-span-full">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">{t('goal_title')}</label>
                  <div className="flex gap-2">
                      <input type="text" placeholder="e.g. Marathon" className="w-full p-5 bg-gray-50 dark:bg-slate-700 dark:text-white rounded-2xl outline-none font-bold" value={newGoal.title} onChange={e => setNewGoal({...newGoal, title: e.target.value})} />
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">{t('category')}</label>
                  <select className="w-full p-5 bg-gray-50 dark:bg-slate-700 dark:text-white rounded-2xl outline-none font-bold" value={newGoal.category} onChange={e => setNewGoal({...newGoal, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{t(`categories.${c.id}`)}</option>)}
                  </select>
                </div>
                
                <div className="relative" onClick={() => dateInputRef.current?.showPicker()}>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 mb-2 block">{t('target_date')}</label>
                  <input ref={dateInputRef} type="date" className="w-full p-5 bg-gray-50 dark:bg-slate-700 dark:text-white rounded-2xl outline-none font-bold cursor-pointer" value={newGoal.targetDate} onChange={e => setNewGoal({...newGoal, targetDate: e.target.value})} />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {quickDates.map(q => (
                  <button key={q.label} onClick={() => setNewGoal({...newGoal, targetDate: q.date})} className="px-5 py-2 rounded-xl text-xs font-black bg-gray-100 dark:bg-slate-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600">
                    {q.label}
                  </button>
                ))}
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-8 rounded-[2.5rem] space-y-6">
                <h4 className="text-sm font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">{t('daily_tasks')}</h4>
                <div className="space-y-3">
                  {dailyTasks.map(t => (
                    <div key={t.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex justify-between items-center mb-3">
                         <span className="font-bold text-gray-900 dark:text-white">{t.title}</span>
                         <button onClick={() => setDailyTasks(dailyTasks.filter(x => x.id !== t.id))} className="text-red-200 hover:text-red-500"><i className="fa-solid fa-circle-minus text-xl"></i></button>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                          {daysLabels.map((l, i) => (
                             <button 
                               key={i} 
                               onClick={() => toggleExistingTaskDay(t.id, i + 1)} 
                               className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all ${t.daysOfWeek.includes(i+1) ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-slate-700 text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600'}`}
                             >
                                {l}
                             </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl space-y-4">
                  <input type="text" placeholder={t('task_placeholder')} className="w-full p-4 bg-gray-50 dark:bg-slate-700 dark:text-white rounded-xl outline-none" value={taskInput} onChange={e => setTaskInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && addNewTask()} />
                  <div className="flex flex-wrap gap-1">
                    {daysLabels.map((l, i) => (
                      <button key={i} onClick={() => toggleDay(i+1)} className={`w-9 h-9 rounded-lg text-xs font-black transition-all ${taskDays.includes(i+1) ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>{l}</button>
                    ))}
                  </div>
                  <button onClick={addNewTask} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black">{t('add_task')}</button>
                </div>
              </div>
              
              {formErrors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold">
                      <ul className="list-disc pl-5 space-y-1">
                          {formErrors.map((err, index) => <li key={index}>{err}</li>)}
                      </ul>
                  </div>
              )}

              <div className="flex gap-4 pt-4">
                <button onClick={handleAddGoal} className="flex-1 bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-transform">{t('save')}</button>
                <button onClick={() => {setIsGoalModalOpen(false); resetGoalForm();}} className="px-10 bg-gray-50 dark:bg-slate-700 text-gray-400 rounded-[2rem] font-black">{t('cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCheckpointModalOpen && selectedGoal && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-md p-12 shadow-2xl text-center">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6"><i className="fa-solid fa-flag-checkered"></i></div>
            <h2 className="text-3xl font-black mb-6 text-gray-900 dark:text-white">{t('add_checkpoint')}</h2>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl mb-6 text-left text-sm text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-800">
               <p className="mb-2"><strong className="font-black">1. {t('checkpoint_desc_1')}</strong></p>
               <p><strong className="font-black">2. {t('checkpoint_desc_2')}</strong></p>
            </div>

            <div className="space-y-5 text-left">
              <input type="text" placeholder={t('record_note')} className="w-full p-4 bg-gray-50 dark:bg-slate-700 dark:text-white rounded-2xl outline-none font-bold" value={checkpointForm.value} onChange={e => setCheckpointForm({...checkpointForm, value: e.target.value})} />
              <input type="number" placeholder={t('record_progress')} className="w-full p-4 bg-gray-50 dark:bg-slate-700 dark:text-white rounded-2xl outline-none font-bold" value={checkpointForm.manualProgress} onChange={e => setCheckpointForm({...checkpointForm, manualProgress: e.target.value})} />
              <button onClick={handleAddCheckpoint} className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black text-lg shadow-xl active:scale-95 transition-transform">{t('save_milestone')}</button>
              <button onClick={() => setIsCheckpointModalOpen(false)} className="w-full text-gray-400 font-bold py-2">{t('close')}</button>
            </div>
          </div>
        </div>
      )}

      {isAnalyticsOpen && selectedGoal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-6xl shadow-2xl p-8 md:p-12 m-auto relative">
            <div className="flex justify-between items-start mb-12">
              <h2 className="text-4xl font-black text-gray-900 dark:text-white">{selectedGoal.title} - {t('analytics')}</h2>
              <button onClick={() => { setIsAnalyticsOpen(false); }} className="w-14 h-14 bg-gray-50 dark:bg-slate-700 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-xmark text-2xl text-gray-400"></i>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                {/* --- AI COACH SECTION --- */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800 p-8 rounded-[3rem] shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                    
                    <div className="flex items-center gap-4 mb-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${
                            user?.aiPersona === 'drill' ? 'bg-red-500 text-white' :
                            user?.aiPersona === 'analytic' ? 'bg-blue-500 text-white' :
                            'bg-emerald-500 text-white'
                        }`}>
                            <i className={`fa-solid ${
                                user?.aiPersona === 'drill' ? 'fa-dumbbell' :
                                user?.aiPersona === 'analytic' ? 'fa-chart-pie' :
                                'fa-leaf'
                            }`}></i>
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">AI Coach</div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white">
                                {user?.aiPersona === 'drill' ? 'Drill Sergeant' : user?.aiPersona === 'analytic' ? 'Data Strategist' : 'Zen Master'}
                            </h3>
                        </div>
                    </div>

                    {!aiAdvice ? (
                        <div className="text-center py-4">
                            <p className="text-gray-500 dark:text-slate-400 mb-6 text-sm font-medium">Click to analyze your current progress and get personalized advice.</p>
                            <button 
                                onClick={handleGetAiAdvice}
                                disabled={isAiAdviceLoading}
                                className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-8 py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                            >
                                {isAiAdviceLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                                {isAiAdviceLoading ? 'Analyzing...' : 'Get Advice'}
                            </button>
                        </div>
                    ) : (
                        <div className="animate-in fade-in zoom-in duration-300">
                             <div className="prose prose-sm dark:prose-invert font-medium text-gray-700 dark:text-slate-300 leading-relaxed bg-white/50 dark:bg-slate-800/50 p-6 rounded-2xl">
                                {aiAdvice.split('\n').map((line, i) => (
                                    <p key={i} className="mb-2 last:mb-0">{line}</p>
                                ))}
                             </div>
                             <div className="mt-4 text-center">
                                 <button onClick={() => setAiAdvice(null)} className="text-xs font-bold text-gray-400 hover:text-indigo-500">Refresh Analysis</button>
                             </div>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-8 rounded-[3rem] h-full">
                  <h3 className="text-xl font-black mb-6 text-gray-900 dark:text-white">{t('milestones')}</h3>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedGoal.checkpoints.length > 0 ? (
                      selectedGoal.checkpoints.slice().reverse().map(cp => (
                        <div key={cp.id} className="p-4 bg-gray-50 dark:bg-slate-700 rounded-2xl flex justify-between items-center hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">
                          <span className="font-bold text-gray-900 dark:text-white">{cp.value}</span>
                          <span className="text-[10px] text-gray-400 font-black">{new Date(cp.date).toLocaleDateString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-400 py-8 text-sm font-medium">No records yet.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-[#FBFBFE] dark:bg-slate-900 p-10 rounded-[3rem] flex flex-col items-center">
                   <div className="text-5xl font-black text-gray-900 dark:text-white mb-2">{selectedGoal.progress}%</div>
                   <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-10">{t('today_progress')}</div>
                   <div className="grid grid-cols-2 gap-6 w-full">
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-50 dark:border-slate-700 text-center">
                        <div className="text-2xl font-black text-gray-900 dark:text-white">{selectedGoal.completions.length}</div>
                        <div className="text-[10px] font-black text-gray-400">{t('completed_total')}</div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-50 dark:border-slate-700 text-center">
                        <div className="text-2xl font-black text-gray-900 dark:text-white">
                          {Math.max(0, Math.ceil((new Date(selectedGoal.targetDate).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)))}
                        </div>
                        <div className="text-[10px] font-black text-gray-400">{t('days_left')}</div>
                      </div>
                   </div>
                </div>

                {user?.tier === UserTier.PREMIUM ? (
                    <div className="space-y-8">
                        {milestoneChartData.length > 0 && (
                            <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-700">
                                <h3 className="text-xl font-black mb-6 text-gray-900 dark:text-white">{t('milestone_chart')}</h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={milestoneChartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f3f4f6'} />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                                            <RechartsTooltip content={<CustomChartTooltip />} cursor={{stroke: '#e0e7ff', strokeWidth: 2}} />
                                            <Line 
                                                type="monotone" 
                                                dataKey="value" 
                                                stroke="#4f46e5" 
                                                strokeWidth={3} 
                                                dot={{r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: isDarkMode ? '#1e293b' : '#fff'}} 
                                                activeDot={{r: 6}} 
                                                animationDuration={1500}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-700">
                            <h3 className="text-xl font-black mb-6 text-gray-900 dark:text-white">{t('last_7_days')}</h3>
                            <div className="flex items-end justify-between h-40 gap-3">
                                {storageService.getLast7DaysStats(selectedGoal, currentDate).map((day, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group cursor-help">
                                        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-t-xl relative h-full w-full overflow-hidden">
                                            <div 
                                                className="absolute bottom-0 w-full bg-indigo-500 rounded-t-xl transition-all duration-1000 ease-out delay-[200ms]" 
                                                style={{height: `${day.percentage}%`}}
                                            ></div>
                                            <div className="opacity-0 group-hover:opacity-100 absolute top-0 w-full text-center text-[8px] font-black text-gray-500 dark:text-slate-400 pt-1 transition-opacity z-10">
                                                {day.percentage}%
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wider">{day.day}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                     <div className="bg-gradient-to-br from-indigo-500 to-purple-700 p-8 rounded-[3rem] text-white text-center shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-full bg-white/5 group-hover:bg-white/10 transition-colors"></div>
                        <div className="relative z-10">
                           <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-inner animate-pulse">
                             <i className="fa-solid fa-lock"></i>
                           </div>
                           <h3 className="text-2xl font-black mb-2">{t('locked_analytics')}</h3>
                           <p className="text-indigo-100 text-sm font-medium mb-6">{t('locked_analytics_desc')}</p>
                           <button onClick={() => setIsPremiumModalOpen(true)} className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-black shadow-lg hover:scale-105 transition-all w-full">
                             {t('unlock_premium')}
                           </button>
                        </div>
                     </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isProfileModalOpen && user && (
        <UserProfileModal 
          user={user}
          onClose={() => setIsProfileModalOpen(false)}
          onUpdateUser={handleUpdateUserProfile}
          onCancelSubscription={() => setUser(storageService.cancelSubscription(user.id))}
          onUpgrade={() => { setIsProfileModalOpen(false); setIsPremiumModalOpen(true); }}
        />
      )}

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-md p-12 shadow-2xl relative transition-all">
            <button 
                onClick={() => setIsAuthModalOpen(false)} 
                className="absolute top-8 right-8 w-10 h-10 rounded-full bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors"
            >
                <i className="fa-solid fa-xmark text-xl"></i>
            </button>
            <h2 className="text-4xl font-black mb-8 text-gray-900 dark:text-white">{t('welcome_back')}</h2>
            
            {!magicLinkSent ? (
               <form onSubmit={handleLogin} className="space-y-6">
                 <input type="email" placeholder={t('enter_email')} className="w-full p-5 bg-gray-50 dark:bg-slate-700 dark:text-white rounded-2xl font-bold border-none" value={email} onChange={e => setEmail(e.target.value)} required />
                 <button disabled={authLoading} className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black text-xl shadow-2xl active:scale-95 transition-all flex justify-center items-center gap-2">
                    {authLoading && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                    {t('enter_app')}
                 </button>
                 <p className="text-center text-xs text-gray-400 mt-4">We'll send you a magic link. No password needed.</p>
               </form>
            ) : (
                <div className="text-center py-8 animate-in zoom-in">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-4xl text-green-500 mx-auto mb-6">
                        <i className="fa-solid fa-envelope-open-text"></i>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Check your inbox!</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">We sent a magic link to <span className="font-bold text-gray-700 dark:text-gray-300">{email}</span>.</p>
                    <button onClick={() => setMagicLinkSent(false)} className="text-indigo-600 font-bold hover:underline">Use different email</button>
                </div>
            )}
          </div>
        </div>
      )}

      {isPremiumModalOpen && <PremiumModal onClose={() => setIsPremiumModalOpen(false)} onUpgrade={() => { setUser(storageService.upgradeToPremium(user!.id)); setIsPremiumModalOpen(false); }} />}
      
      {/* Simulation Panel - Only visible in DevMode */}
      {isDevMode && <SimulationPanel />}
    </div>
  );
};

export default App;
