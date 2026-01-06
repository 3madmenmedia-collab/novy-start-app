
import React, { useMemo } from 'react';
import { Goal } from '../types';
import { CATEGORIES } from '../constants';
import { useSettings } from '../contexts/SettingsContext';

interface GoalCardProps {
  goal: Goal;
  onUpdate: (id: string) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onViewAnalytics: (goal: Goal) => void;
  onToggleTask: (goalId: string, taskId: string) => void;
  isPremium: boolean;
  currentDate: Date;
}

const GoalCard: React.FC<GoalCardProps> = ({ goal, onUpdate, onEdit, onDelete, onViewAnalytics, onToggleTask, currentDate }) => {
  const { t } = useSettings();
  const category = CATEGORIES.find(c => c.id === goal.category);
  
  const todayStr = currentDate.toISOString().split('T')[0];
  const currentDayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay();
  
  const isFinished = new Date(todayStr) > new Date(goal.targetDate);
  const todayScheduledTasks = goal.dailyTasks.filter(t => t.daysOfWeek.includes(currentDayOfWeek));
  
  const milestoneStatus = useMemo(() => {
    if (!goal.plannedCheckpoints) return { type: 'none' };

    const recordedToday = goal.checkpoints.some(cp => cp.date === todayStr);
    if (recordedToday) {
        return { type: 'completed_today' };
    }

    const pendingDate = goal.plannedCheckpoints
        .sort()
        .find(date => date <= todayStr && !goal.checkpoints.some(cp => cp.date === date));

    if (pendingDate) {
        const diffTime = new Date(pendingDate).getTime() - new Date(todayStr).getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return { 
            type: 'pending', 
            date: pendingDate, 
            isOverdue: diffDays < 0,
            daysDiff: Math.abs(diffDays)
        };
    }

    const upcoming = goal.plannedCheckpoints.sort().find(date => date > todayStr);
    if (upcoming) {
        const diffTime = new Date(upcoming).getTime() - new Date(todayStr).getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { type: 'future', date: upcoming, days: diffDays };
    }

    return { type: 'none' };
  }, [goal.plannedCheckpoints, goal.checkpoints, todayStr]);

  const isTaskCompleted = (taskId: string) => {
    return goal.completions.some(c => c.date === todayStr && c.taskId === taskId);
  };

  const handleToggle = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation(); 
    onToggleTask(goal.id, taskId);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete(goal.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit(goal);
  };

  const handleAnalytics = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onViewAnalytics(goal);
  };

  if (isFinished) {
      return (
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 transition-all hover:shadow-xl relative flex flex-col h-full overflow-hidden">
            <div className={`p-8 pb-4 bg-gradient-to-br ${goal.progress >= 80 ? 'from-emerald-50 to-emerald-100 dark:from-emerald-900 dark:to-emerald-800' : 'from-gray-50 to-gray-100 dark:from-slate-700 dark:to-slate-600'}`}>
                <div className="flex justify-between items-start mb-4">
                     <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${goal.progress >= 80 ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-200 text-gray-500'}`}>
                        {goal.progress >= 80 ? t('status.done') : t('status.ended')}
                     </span>
                     <button type="button" onClick={handleDelete} className="w-8 h-8 rounded-full bg-white/50 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors">
                        <i className="fa-solid fa-trash-can text-xs"></i>
                     </button>
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight mb-2">{goal.title}</h3>
                <div className="flex items-end gap-2">
                    <span className={`text-4xl font-black ${goal.progress >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-300'}`}>{goal.progress}%</span>
                </div>
            </div>

            <div className="p-8 flex-grow">
                 <div className="grid grid-cols-2 gap-4 mb-6">
                     <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-2xl text-center">
                         <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{goal.checkpoints.length}</div>
                         <div className="text-[10px] font-bold text-gray-400 uppercase">{t('milestones')}</div>
                     </div>
                     <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-2xl text-center">
                         <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{goal.completions.length}</div>
                         <div className="text-[10px] font-bold text-gray-400 uppercase">{t('completed_total')}</div>
                     </div>
                 </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-slate-700">
                 <button onClick={handleAnalytics} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">
                    {t('analytics')}
                 </button>
            </div>
        </div>
      );
  }

  // --- ACTIVE STATE RENDER ---
  let footerBg = 'bg-gray-50/80 dark:bg-slate-700/50 border-gray-100 dark:border-slate-700';
  let footerIconColor = 'text-gray-400 dark:text-slate-500';
  let footerTextColor = 'text-gray-400 dark:text-slate-500';

  if (milestoneStatus.type === 'pending') {
      footerBg = 'bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800';
      footerIconColor = 'text-amber-500';
      footerTextColor = 'text-amber-700 dark:text-amber-400';
  } else if (milestoneStatus.type === 'completed_today') {
      footerBg = 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800';
      footerIconColor = 'text-emerald-500';
      footerTextColor = 'text-emerald-700 dark:text-emerald-400';
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 transition-all hover:shadow-xl hover:-translate-y-1 relative flex flex-col h-full group animate-in fade-in duration-500 overflow-hidden">
      
      {goal.image ? (
        <div className="h-40 w-full relative overflow-hidden flex-shrink-0">
          <img src={goal.image} alt={goal.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-800 via-transparent to-transparent"></div>
          <div className="absolute top-4 left-4 z-10">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-white/90 backdrop-blur-sm text-indigo-600 shadow-lg`}>
              <i className={`fa-solid ${category?.icon || 'fa-star'}`}></i>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 pb-0 flex-shrink-0">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-indigo-50 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm shadow-indigo-50`}>
            <i className={`fa-solid ${category?.icon || 'fa-star'}`}></i>
          </div>
        </div>
      )}

      {goal.streak > 0 && (
          <div className="absolute top-4 right-16 z-10 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow-sm flex items-center gap-1 border border-orange-100 animate-in zoom-in">
              <i className="fa-solid fa-fire text-orange-500 text-xs animate-pulse"></i>
              <span className="text-xs font-black text-orange-600">{goal.streak}</span>
          </div>
      )}

      <div className={`absolute top-4 right-4 z-50 flex gap-2 transition-opacity duration-300 ${goal.image ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button type="button" onClick={handleAnalytics} className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-md text-gray-400 hover:text-indigo-600 transition-colors flex items-center justify-center shadow-lg cursor-pointer hover:scale-110">
            <i className="fa-solid fa-chart-line text-sm pointer-events-none"></i>
          </button>
          <button type="button" onClick={handleEdit} className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-md text-gray-400 hover:text-indigo-600 transition-colors flex items-center justify-center shadow-lg cursor-pointer hover:scale-110">
            <i className="fa-solid fa-pencil text-xs pointer-events-none"></i>
          </button>
          <button type="button" onClick={handleDelete} className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-md text-red-300 hover:text-red-500 transition-colors flex items-center justify-center shadow-lg cursor-pointer hover:scale-110">
            <i className="fa-solid fa-trash-can text-xs pointer-events-none"></i>
          </button>
      </div>

      <div className="p-8 pt-6 pb-0 flex flex-col flex-grow relative z-20">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight flex-1 mr-2">{goal.title}</h3>
          
          {!goal.image && (
             <div className="flex gap-2 flex-shrink-0 md:hidden"> 
              <button type="button" onClick={handleAnalytics} className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-700 text-gray-400"><i className="fa-solid fa-chart-line text-xs"></i></button>
              <button type="button" onClick={handleEdit} className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-700 text-gray-400"><i className="fa-solid fa-pencil text-xs"></i></button>
              <button type="button" onClick={handleDelete} className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-700 text-red-300"><i className="fa-solid fa-trash-can text-xs"></i></button>
            </div>
          )}
        </div>
        
        <p className="text-gray-500 dark:text-slate-400 font-medium mb-6 line-clamp-2">{goal.description}</p>
        
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('today_progress')}</div>
            <div className="text-lg font-black text-indigo-600 dark:text-indigo-400">{goal.progress}%</div>
          </div>
          <div className="h-3 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-1000 ease-out relative overflow-hidden" 
              style={{ width: `${goal.progress}%` }}
            >
                <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-shimmer"></div>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-3 mb-6">
           <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 flex justify-between">
              <span>{t('daily_tasks')}</span>
              <span>{todayScheduledTasks.filter(t => isTaskCompleted(t.id)).length} / {todayScheduledTasks.length}</span>
           </div>
           
           {todayScheduledTasks.length > 0 ? todayScheduledTasks.map(task => {
             const completed = isTaskCompleted(task.id);
             return (
               <div 
                 key={task.id} 
                 onClick={(e) => handleToggle(e, task.id)}
                 className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group/task relative overflow-hidden active:scale-95 ${completed ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:border-gray-200'}`}
               >
                 <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${completed ? 'bg-indigo-600 border-indigo-600 text-white scale-110' : 'border-gray-200 dark:border-slate-600 text-transparent group-hover/task:border-indigo-300'}`}>
                   <i className="fa-solid fa-check text-xs"></i>
                 </div>
                 <span className={`font-bold transition-colors ${completed ? 'text-indigo-900 dark:text-indigo-200 line-through decoration-indigo-300' : 'text-gray-700 dark:text-slate-200'}`}>{task.title}</span>
               </div>
             );
           }) : (
             <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 text-center">
                <span className="text-xs font-bold text-gray-400">{t('today_tasks')}</span>
             </div>
           )}
        </div>
      </div>

      <div className={`p-6 mt-auto border-t transition-colors duration-500 ${footerBg}`}>
        <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-2">
                 <i className={`fa-solid fa-flag-checkered ${footerIconColor}`}></i>
                 <span className={`text-[10px] font-black uppercase tracking-widest ${footerTextColor}`}>
                    {t('milestones')}
                 </span>
             </div>
             
             {milestoneStatus.type === 'pending' && (
                 <span className="text-xs font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                     {milestoneStatus.isOverdue 
                        ? `${t('footer_overdue')}`
                        : 'Action required'
                     }
                 </span>
             )}
             {milestoneStatus.type === 'completed_today' && (
                 <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                     <i className="fa-solid fa-check ml-1"></i>
                 </span>
             )}
             {milestoneStatus.type === 'future' && (
                 <span className="text-xs font-bold text-gray-400">
                     {t('footer_future')} {milestoneStatus.days} {t('days')}
                 </span>
             )}
        </div>

        {milestoneStatus.type === 'completed_today' ? (
             <div className="w-full py-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center justify-center gap-2">
                 <i className="fa-solid fa-thumbs-up"></i>
                 <span>{t('footer_milestone_done')}</span>
             </div>
        ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdate(goal.id); }}
              className={`w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 ${
                milestoneStatus.type === 'pending'
                  ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200 animate-pulse' 
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-200 border border-gray-200 dark:border-slate-600 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {milestoneStatus.type === 'pending' ? (
                 <>
                   <i className="fa-solid fa-exclamation-circle"></i>
                   {t('footer_milestone_pending')}
                 </>
              ) : (
                 <>
                   <i className="fa-solid fa-plus"></i>
                   {t('footer_milestone_add')}
                 </>
              )}
            </button>
        )}
      </div>

    </div>
  );
};

export default GoalCard;
