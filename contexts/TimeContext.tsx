
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';

interface TimeContextType {
  currentDate: Date;
  isSimulationRunning: boolean;
  toggleSimulation: () => void;
  resetSimulation: () => void;
}

const TimeContext = createContext<TimeContextType | undefined>(undefined);

export const TimeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isSimulationRunning) {
      // Normal clock update (every second for UI responsiveness)
      const interval = setInterval(() => {
        setCurrentDate(new Date());
      }, 1000); 
      return () => clearInterval(interval);
    }

    // Simulation logic: 3 minutes real time = 1 day (24 hours) sim time
    // 24 hours = 1440 minutes. Ratio = 1440 / 3 = 480x speed.
    const SPEED_FACTOR = 480;

    let animationFrameId: number;
    lastUpdateRef.current = Date.now();

    const animate = () => {
        const now = Date.now();
        const delta = now - lastUpdateRef.current;
        lastUpdateRef.current = now;
        
        setCurrentDate(prev => new Date(prev.getTime() + delta * SPEED_FACTOR));
        animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isSimulationRunning]);

  const toggleSimulation = () => {
    setIsSimulationRunning(prev => !prev);
  };

  const resetSimulation = () => {
    setIsSimulationRunning(false);
    setCurrentDate(new Date());
  };

  return (
    <TimeContext.Provider value={{ currentDate, isSimulationRunning, toggleSimulation, resetSimulation }}>
      {children}
    </TimeContext.Provider>
  );
};

export const useTime = () => {
  const context = useContext(TimeContext);
  if (!context) throw new Error('useTime must be used within a TimeProvider');
  return context;
};
