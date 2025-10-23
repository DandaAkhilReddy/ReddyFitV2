import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type FitnessLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type Goal = 'Build Muscle' | 'Lose Fat' | 'Improve Endurance';

interface UserPreferences {
  fitnessLevel: FitnessLevel;
  goal: Goal;
  caloriesGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
}

interface UserPreferencesContextType extends UserPreferences {
  setFitnessLevel: (level: FitnessLevel) => void;
  setGoal: (goal: Goal) => void;
  setCaloriesGoal: (calories: number) => void;
  setProteinGoal: (protein: number) => void;
  setCarbsGoal: (carbs: number) => void;
  setFatGoal: (fat: number) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

const PREFERENCES_KEY = 'reddyfit-user-preferences-v2';

const loadPreferences = (): UserPreferences => {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Basic validation to ensure stored data is somewhat valid
      if (parsed.fitnessLevel && parsed.goal) {
        return {
          fitnessLevel: parsed.fitnessLevel,
          goal: parsed.goal,
          caloriesGoal: parsed.caloriesGoal || 2500,
          proteinGoal: parsed.proteinGoal || 150,
          carbsGoal: parsed.carbsGoal || 300,
          fatGoal: parsed.fatGoal || 70,
        };
      }
    }
  } catch (error) {
    console.error("Failed to load user preferences from localStorage", error);
  }
  // Return default values if nothing is stored or if data is invalid
  return {
    fitnessLevel: 'Intermediate',
    goal: 'Build Muscle',
    caloriesGoal: 2500,
    proteinGoal: 150,
    carbsGoal: 300,
    fatGoal: 70,
  };
};

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("Failed to save user preferences to localStorage", error);
    }
  }, [preferences]);

  const setFitnessLevel = useCallback((level: FitnessLevel) => {
    setPreferences(prev => ({ ...prev, fitnessLevel: level }));
  }, []);

  const setGoal = useCallback((goal: Goal) => {
    setPreferences(prev => ({ ...prev, goal: goal }));
  }, []);
  
  const setCaloriesGoal = useCallback((calories: number) => {
    setPreferences(prev => ({ ...prev, caloriesGoal: calories }));
  }, []);

  const setProteinGoal = useCallback((protein: number) => {
    setPreferences(prev => ({ ...prev, proteinGoal: protein }));
  }, []);

  const setCarbsGoal = useCallback((carbs: number) => {
    setPreferences(prev => ({ ...prev, carbsGoal: carbs }));
  }, []);

  const setFatGoal = useCallback((fat: number) => {
    setPreferences(prev => ({ ...prev, fatGoal: fat }));
  }, []);

  const value = { ...preferences, setFitnessLevel, setGoal, setCaloriesGoal, setProteinGoal, setCarbsGoal, setFatGoal };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferences = (): UserPreferencesContextType => {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
};
