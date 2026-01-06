
import React, { useState } from 'react';
import { User, UserTier, AIPersona } from '../types';
import { BADGES_DEFINITIONS, STRIPE_CONFIG } from '../constants';
import { useSettings } from '../contexts/SettingsContext';

interface UserProfileModalProps {
  user: User;
  onClose: () => void;
  onUpdateUser: (user: User) => void;
  onCancelSubscription: () => void;
  onUpgrade: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, onClose, onUpdateUser, onCancelSubscription, onUpgrade }) => {
  const { t, isDevMode, toggleDevMode } = useSettings();
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'gamification' | 'ai'>('profile');
  const [name, setName] = useState(user.name);
  const [selectedPersona, setSelectedPersona] = useState<AIPersona>(user.aiPersona || 'zen');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      onUpdateUser({ ...user, name, aiPersona: selectedPersona });
      setIsSaving(false);
    }, 600);
  };

  const handleOpenStripePortal = () => {
    if (STRIPE_CONFIG.CUSTOMER_PORTAL_URL.includes("stripe.com/p/login")) {
        window.location.href = STRIPE_CONFIG.CUSTOMER_PORTAL_URL;
    } else {
        alert("Simulation: Redirect to Stripe Customer Portal.");
    }
  };

  const personas: {id: AIPersona, icon: string, color: string}[] = [
      { id: 'zen', icon: 'fa-leaf', color: 'emerald' },
      { id: 'drill', icon: 'fa-dumbbell', color: 'red' },
      { id: 'analytic', icon: 'fa-chart-pie', color: 'blue' }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-2xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 sticky top-0 z-10">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t('profile')}</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
          <div className="w-full md:w-1/3 bg-gray-50 dark:bg-slate-900 p-6 flex flex-row md:flex-col gap-2 overflow-x-auto flex-shrink-0">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`}
            >
              <i className="fa-solid fa-user-circle"></i> {t('personal_data')}
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'ai' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`}
            >
              <i className="fa-solid fa-robot"></i> {t('ai_coach')}
            </button>
            <button 
              onClick={() => setActiveTab('gamification')}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'gamification' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`}
            >
              <i className="fa-solid fa-trophy"></i> {t('collection')}
            </button>
            <button 
              onClick={() => setActiveTab('billing')}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'billing' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`}
            >
              <i className="fa-solid fa-credit-card"></i> {t('subscription')}
            </button>
            
            <div className="mt-auto pt-4 hidden md:block">
               <button onClick={toggleDevMode} className={`text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg w-full transition-colors ${isDevMode ? 'bg-red-50 text-red-500' : 'text-gray-300 hover:text-gray-400'}`}>
                  {isDevMode ? 'DEV MODE: ON' : 'v1.0.0'}
               </button>
            </div>
          </div>

          <div className="w-full md:w-2/3 p-8 overflow-y-auto">
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block">Name</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-4 bg-gray-50 dark:bg-slate-700 dark:text-white rounded-xl outline-none font-bold text-gray-900 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                 </div>
                 
                 <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block">E-mail</label>
                    <div className="w-full p-4 bg-gray-50/50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 rounded-xl font-medium text-gray-400 cursor-not-allowed">
                      {user.email}
                    </div>
                 </div>
                 
                 <div className="pt-4 border-t border-gray-50 dark:border-slate-700 mt-8">
                    <button disabled={isSaving} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
                       {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                       {t('save_changes')}
                    </button>
                 </div>
                 
                 {/* Mobile dev toggle */}
                 <div className="md:hidden pt-8 text-center">
                    <button type="button" onClick={toggleDevMode} className={`text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg transition-colors ${isDevMode ? 'bg-red-50 text-red-500' : 'text-gray-300'}`}>
                        {isDevMode ? 'DEV MODE: ON' : 'VERSION 1.0.0'}
                    </button>
                 </div>
              </form>
            )}

            {activeTab === 'ai' && (
                <div className="space-y-6">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl text-sm text-indigo-800 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800">
                        <i className="fa-solid fa-circle-info mr-2"></i>
                        {t('select_persona_msg')}
                    </div>

                    <div className="space-y-3">
                        {personas.map(persona => (
                            <div 
                                key={persona.id}
                                onClick={() => setSelectedPersona(persona.id)}
                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${selectedPersona === persona.id ? `border-${persona.color}-500 bg-${persona.color}-50 dark:bg-${persona.color}-900/20 shadow-md` : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600'}`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${selectedPersona === persona.id ? `bg-${persona.color}-100 dark:bg-${persona.color}-800 text-${persona.color}-600 dark:text-${persona.color}-300` : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                                    <i className={`fa-solid ${persona.icon}`}></i>
                                </div>
                                <div>
                                    <div className="font-black text-gray-900 dark:text-white text-lg">{t(`ai_persona_${persona.id}_title`)}</div>
                                    <div className="text-xs font-medium text-gray-500 dark:text-slate-400">{t(`ai_persona_${persona.id}_desc`)}</div>
                                </div>
                                {selectedPersona === persona.id && (
                                    <div className={`ml-auto text-${persona.color}-600 dark:text-${persona.color}-400`}>
                                        <i className="fa-solid fa-circle-check text-2xl"></i>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-gray-50 dark:border-slate-700 mt-8">
                        <button onClick={handleSaveProfile} disabled={isSaving} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
                           {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                           {t('save_changes')}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'gamification' && (
                <div>
                    <h3 className="font-black text-xl mb-6 text-gray-900 dark:text-white">Badge Collection</h3>
                    <div className="grid grid-cols-3 gap-4">
                        {BADGES_DEFINITIONS.map(def => {
                            const isEarned = user.badges.some(b => b.id === def.id);
                            return (
                                <div key={def.id} className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 text-center border-2 ${isEarned ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 grayscale opacity-50'}`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl mb-2 ${isEarned ? 'bg-amber-100 dark:bg-amber-900 text-amber-500' : 'bg-gray-200 dark:bg-slate-700 text-gray-400'}`}>
                                        <i className={`fa-solid ${def.icon}`}></i>
                                    </div>
                                    <div className="text-[10px] font-black uppercase text-gray-500 dark:text-slate-400 leading-tight">{t(`badges.${def.id}.label`)}</div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="mt-8 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-center">
                        <div className="text-sm font-bold text-indigo-900 dark:text-indigo-200">{t('level')} {user.level || 1}</div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-2">{user.xp || 0} XP</div>
                        <div className="h-2 w-full bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                           <div className="h-full bg-indigo-600" style={{ width: `${((user.xp || 0) / ((user.level || 1) * 200)) * 100}%` }}></div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-8">
                <div className={`p-6 rounded-2xl border ${user.tier === UserTier.PREMIUM ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800' : 'bg-gray-50 dark:bg-slate-700 border-gray-100 dark:border-slate-600'}`}>
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('current_plan')}</span>
                      {user.tier === UserTier.PREMIUM ? (
                        <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">Premium</span>
                      ) : (
                        <span className="bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-300 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">Free Trial</span>
                      )}
                   </div>
                   
                   {user.tier === UserTier.PREMIUM ? (
                      <div>
                        <div className="text-2xl font-black text-indigo-900 dark:text-indigo-200 mb-1">199 Kč / month</div>
                        
                        <div className="flex flex-col gap-3 mt-6">
                           <button onClick={handleOpenStripePortal} className="w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 py-3 rounded-xl font-bold hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors flex justify-center items-center gap-2">
                              <i className="fa-solid fa-up-right-from-square"></i> {t('manage_stripe')}
                           </button>
                        </div>
                      </div>
                   ) : (
                      <div>
                        <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">Free</div>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 font-medium">{Math.max(0, 14 - Math.floor((Date.now() - user.trialStartedAt) / (1000 * 60 * 60 * 24)))} {t('trial_days_left')}.</p>
                        <button onClick={() => { onClose(); onUpgrade(); }} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                           {t('premium_upgrade')}
                        </button>
                      </div>
                   )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
