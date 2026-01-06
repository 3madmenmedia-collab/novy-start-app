
import React from 'react';
import { useTime } from '../contexts/TimeContext';

const SimulationPanel: React.FC = () => {
  const { currentDate, isSimulationRunning, toggleSimulation, resetSimulation } = useTime();

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 w-64 animate-in slide-in-from-bottom duration-300">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400">
          <i className="fa-solid fa-flask mr-2"></i> Testovací Lab
        </h3>
        <div className={`w-2 h-2 rounded-full ${isSimulationRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
      </div>

      <div className="mb-4">
        <div className="text-2xl font-black font-mono">
          {currentDate.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-sm font-medium text-slate-400">
          {currentDate.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={toggleSimulation}
          className={`flex-1 py-2 rounded-lg font-bold text-xs transition-colors ${isSimulationRunning ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
        >
          {isSimulationRunning ? 'Zastavit' : 'Spustit Simulaci'}
        </button>
        {isSimulationRunning && (
           <button 
             onClick={resetSimulation}
             className="w-10 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-300"
             title="Resetovat na reálný čas"
           >
             <i className="fa-solid fa-rotate-left"></i>
           </button>
        )}
      </div>
      
      {isSimulationRunning && (
        <div className="mt-3 text-[10px] text-slate-500 leading-tight">
          <i className="fa-solid fa-triangle-exclamation mr-1"></i>
          Používáš oddělenou databázi. Tvá reálná data jsou v bezpečí. 3 minuty = 1 den.
        </div>
      )}
    </div>
  );
};

export default SimulationPanel;
