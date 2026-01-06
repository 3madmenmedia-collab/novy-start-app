
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, translations } from '../lib/translations';

interface SettingsContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isDevMode: boolean;
  toggleDevMode: () => void;
  t: (key: string) => any;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    // Load language
    const savedLang = localStorage.getItem('app_lang') as Language;
    if (savedLang) setLanguageState(savedLang);

    // Load dev mode
    const savedDevMode = localStorage.getItem('app_dev_mode');
    if (savedDevMode === 'true') setIsDevMode(true);

    // Load theme logic
    const savedTheme = localStorage.getItem('app_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Rozhodneme, zda má být dark mode aktivní
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);

    setIsDarkMode(shouldBeDark);
    
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_lang', lang);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      if (newVal) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('app_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('app_theme', 'light');
      }
      return newVal;
    });
  };

  const toggleDevMode = () => {
    setIsDevMode(prev => {
      const newVal = !prev;
      localStorage.setItem('app_dev_mode', String(newVal));
      return newVal;
    });
  };

  const t = (key: string): any => {
    const keys = key.split('.');
    let current: any = translations[language];
    
    for (const k of keys) {
        if (current === undefined || current === null) return key;
        current = current[k];
    }
    
    return current !== undefined ? current : key;
  };

  return (
    <SettingsContext.Provider value={{ language, setLanguage, isDarkMode, toggleDarkMode, isDevMode, toggleDevMode, t }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
