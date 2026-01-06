
import React from 'react';
import { STRIPE_CONFIG } from '../constants';
import { useSettings } from '../contexts/SettingsContext';

interface PremiumModalProps {
  onClose: () => void;
  onUpgrade: () => void; 
}

const PremiumModal: React.FC<PremiumModalProps> = ({ onClose, onUpgrade }) => {
  const { t } = useSettings();
  
  const handlePaymentRedirect = () => {
    if (STRIPE_CONFIG.PAYMENT_LINK_URL.includes("test_...")) {
        const confirm = window.confirm("DEMO MODE: Simulate successful payment?");
        if (confirm) {
            onUpgrade();
        }
    } else {
        window.location.href = STRIPE_CONFIG.PAYMENT_LINK_URL;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-500 modal-enter">
        <div className="bg-indigo-600 p-12 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500 to-purple-700 opacity-50"></div>
          <button onClick={onClose} className="absolute top-6 right-6 hover:scale-125 transition-transform z-10 text-white/50 hover:text-white">
            <i className="fa-solid fa-xmark text-2xl"></i>
          </button>
          
          <div className="relative z-10">
            <div className="bg-white/20 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl border border-white/10">
              <i className="fa-solid fa-crown text-5xl text-amber-300 drop-shadow-lg"></i>
            </div>
            <h2 className="text-4xl font-black mb-3 leading-tight tracking-tight">{t('premium_modal_title')}</h2>
            <p className="text-indigo-100 font-medium text-lg">{t('premium_modal_subtitle')}</p>
          </div>
        </div>
        
        <div className="p-10">
          <ul className="space-y-6 mb-10">
            {[
              { text: t('premium_benefit_1'), icon: 'fa-infinity', color: 'indigo' },
              { text: t('premium_benefit_2'), icon: 'fa-chart-line', color: 'emerald' },
              { text: t('premium_benefit_3'), icon: 'fa-robot', color: 'purple' },
              { text: t('premium_benefit_4'), icon: 'fa-fire', color: 'orange' }
            ].map((item, idx) => (
              <li key={idx} className="flex items-center text-gray-700 dark:text-slate-300 gap-5 group">
                <div className={`w-11 h-11 bg-${item.color}-50 dark:bg-${item.color}-900/20 text-${item.color}-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border border-${item.color}-100 dark:border-${item.color}-900 transition-transform group-hover:scale-110`}>
                  <i className={`fa-solid ${item.icon}`}></i>
                </div>
                <div>
                    <span className="font-bold block">{item.text}</span>
                </div>
              </li>
            ))}
          </ul>
          
          <button 
            onClick={handlePaymentRedirect}
            className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl text-xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2"
          >
            <span>{t('activate_premium')}</span>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
          <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 dark:text-slate-500 mt-8">{t('secure_payment')}</p>
        </div>
      </div>
    </div>
  );
};

export default PremiumModal;
