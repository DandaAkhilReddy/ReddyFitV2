import React, { useState, useCallback, useEffect } from 'react';
// Fix: Use firebase.User type from compat library
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { useToast } from '../hooks/useToast';
import { fileToBase64 } from '../utils/helpers';
import * as geminiService from '../services/geminiService';
import * as firestoreService from '../services/firestoreService';
import { Loader } from './shared/Loader';
import { ErrorMessage } from './shared/ErrorMessage';
import { UploadIcon } from './shared/icons';
import { useUserPreferences } from '../hooks/useUserPreferences';

interface DashboardProps {
    user: firebase.User | null;
    userProfile: firestoreService.UserProfile | null;
}

const ContributorProgress: React.FC<{ userProfile: firestoreService.UserProfile | null }> = ({ userProfile }) => {
    if (!userProfile) return null;

    const { points } = userProfile;
    let level = "Novice Contributor";
    let nextLevelPoints = 5;
    let progress = (points / nextLevelPoints) * 100;

    if (points >= 20) {
        level = "AI Trainer";
        nextLevelPoints = Infinity; // Max level
        progress = 100;
    } else if (points >= 10) {
        level = "Equipment Expert";
        nextLevelPoints = 20;
        progress = ((points - 10) / (nextLevelPoints - 10)) * 100;
    } else if (points >= 5) {
        level = "Equipment Spotter";
        nextLevelPoints = 10;
        progress = ((points - 5) / (nextLevelPoints - 5)) * 100;
    }

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700">
            <h2 className="text-lg font-bold text-center mb-4 text-amber-400">Contributor Progress</h2>
            <div className="text-center space-y-2 flex flex-col items-center justify-center">
                <p className="text-4xl font-bold text-white">{points}</p>
                <p className="text-xs text-slate-400 -mt-2">Points Earned</p>
                <div className="pt-1">
                    <p className="text-md font-semibold text-amber-300">{level}</p>
                    {nextLevelPoints !== Infinity ? (
                        <>
                            <div className="w-full max-w-xs mx-auto bg-slate-700 rounded-full h-2 my-2">
                                <div
                                    className="bg-gradient-to-r from-amber-500 to-orange-600 h-2 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-slate-500">{nextLevelPoints - points} points to next level</p>
                        </>
                    ) : (
                        <p className="text-xs text-green-400">You've reached the highest level!</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const CalorieTracker: React.FC<{ calories: number; goal: number }> = ({ calories, goal }) => {
    const progress = goal > 0 ? Math.min((calories / goal) * 100, 100) : 0;
    const strokeDasharray = 2 * Math.PI * 46; // smaller radius
    const strokeDashoffset = strokeDasharray - (strokeDasharray * progress) / 100;

    return (
        <div className="relative w-36 h-36">
            <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                    className="text-slate-700"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="46"
                    cx="50"
                    cy="50"
                />
                <circle
                    className="text-amber-500"
                    strokeWidth="8"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="46"
                    cx="50"
                    cy="50"
                    transform="rotate(-90 50 50)"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold text-white">{Math.round(calories)}</span>
                <span className="text-xs text-slate-400">/ {goal} kcal</span>
            </div>
        </div>
    );
};

const MacroBar: React.FC<{ label: string; value: number; goal: number; color: string }> = ({ label, value, goal, color }) => {
    const progress = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
    return (
        <div>
            <div className="flex justify-between items-center mb-1 text-xs">
                <span className="font-semibold text-slate-300">{label}</span>
                <span className="text-slate-400">{Math.round(value)}g / {goal}g</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                    className={`${color} h-1.5 rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ user, userProfile }) => {
    const { showToast } = useToast();
    const { caloriesGoal, proteinGoal, carbsGoal, fatGoal } = useUserPreferences();
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [mealLogs, setMealLogs] = useState<firestoreService.MealLog[]>([]);
    const [dailyTotals, setDailyTotals] = useState({ calories: 0, protein: 0, carbohydrates: 0, fat: 0 });

    const fetchMealLogs = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setLoadingMessage('Loading your dashboard...');
        try {
            const logs = await firestoreService.getTodaysMealLogs(user.uid);
            setMealLogs(logs);
        } catch (e: any) {
            setError('Could not load your meal logs. Please try refreshing.');
            showToast(e.message, 'error');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [user, showToast]);

    useEffect(() => {
        fetchMealLogs();
    }, [fetchMealLogs]);

    useEffect(() => {
        const totals = mealLogs.reduce((acc, log) => {
            acc.calories += log.nutrition.calories;
            acc.protein += log.nutrition.macronutrients.protein;
            acc.carbohydrates += log.nutrition.macronutrients.carbohydrates;
            acc.fat += log.nutrition.macronutrients.fat;
            return acc;
        }, { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
        setDailyTotals(totals);
    }, [mealLogs]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;
        if (!file.type.startsWith('image/')) {
            showToast("Please select a valid image file.", "error");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            setLoadingMessage('Analyzing your meal...');
            const base64Image = await fileToBase64(file);
            const foodItems = await geminiService.analyzeFoodImage(base64Image, file.type);
            if (foodItems.length === 0) throw new Error("Could not identify any food in the image.");
            
            setLoadingMessage('Calculating nutrition...');
            const nutrition = await geminiService.getNutritionalAnalysis(foodItems);
            
            setLoadingMessage('Saving your log...');
            const imageUrl = await firestoreService.uploadImage(file, user.uid);
            
            await firestoreService.saveMealLog(user.uid, { imageUrl, foodItems, nutrition });

            showToast("Meal logged successfully!", "success");
            await fetchMealLogs();

        } catch (e: any) {
            const errorMessage = e.message || 'An unknown error occurred while logging your meal.';
            setError(`Failed to log meal: ${errorMessage}`);
            showToast(`Error: ${errorMessage}`, "error");
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
            // Reset file input so the same file can be selected again
            if(event.target){
                event.target.value = '';
            }
        }
    };
    
    return (
        <section className="space-y-6">
             <header className="mb-2">
                <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
                <p className="text-sm text-slate-400">Welcome back, {userProfile?.displayName || user?.email}!</p>
            </header>

            <div className="bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700">
                <h2 className="text-lg font-bold mb-4 text-amber-400">Today's Nutrition</h2>
                <div className="flex items-center justify-between gap-4">
                    <CalorieTracker calories={dailyTotals.calories} goal={caloriesGoal} />
                    <div className="w-full flex-1 space-y-3">
                        <MacroBar label="Protein" value={dailyTotals.protein} goal={proteinGoal} color="bg-red-500" />
                        <MacroBar label="Carbs" value={dailyTotals.carbohydrates} goal={carbsGoal} color="bg-blue-500" />
                        <MacroBar label="Fat" value={dailyTotals.fat} goal={fatGoal} color="bg-yellow-500" />
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700">
                <h2 className="text-lg font-bold mb-4 text-amber-400">Log Your Meal</h2>
                <label 
                    htmlFor="meal-upload" 
                    className="flex flex-col items-center justify-center w-full h-40 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800/50 hover:bg-slate-700/50 hover:border-amber-500 transition-all duration-300 group"
                >
                    {isLoading && !loadingMessage.includes('dashboard') ? (
                        <Loader text={loadingMessage} />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center">
                            <UploadIcon className="w-8 h-8 mb-2 text-slate-500 group-hover:text-amber-400 transition-colors"/>
                            <p className="text-sm text-slate-300"><span className="font-semibold text-amber-400">Tap to upload</span> a photo</p>
                            <p className="text-xs text-slate-500">The AI will analyze it and log your nutrition!</p>
                        </div>
                    )}
                    <input id="meal-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isLoading}/>
                </label>
            </div>
            
            <ContributorProgress userProfile={userProfile} />

            {error && <ErrorMessage error={error} onRetry={() => setError(null)} />}

            {/* Meal Logs */}
            <div className="bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700">
                <h2 className="text-lg font-bold text-center mb-4 text-amber-400">Today's Meals</h2>
                {isLoading && loadingMessage.includes('dashboard') ? <Loader text="Loading meal logs..."/> :
                mealLogs.length > 0 ? (
                    <div className="space-y-4">
                        {mealLogs.map(log => (
                            <div key={log.id} className="flex gap-4 bg-slate-800 p-3 rounded-lg border border-slate-700">
                                <img src={log.imageUrl} alt="Logged meal" className="w-24 h-24 object-cover rounded-md flex-shrink-0" />
                                <div className="space-y-2 flex-grow">
                                    <div>
                                        <h3 className="font-semibold text-sm text-slate-300">Identified Foods:</h3>
                                        <p className="text-xs text-slate-400">{log.foodItems.join(', ')}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-xs">
                                        <div className="bg-slate-700 p-1 rounded"><strong>Cals:</strong> {log.nutrition.calories}</div>
                                        <div className="bg-slate-700 p-1 rounded"><strong>P:</strong> {log.nutrition.macronutrients.protein}g</div>
                                        <div className="bg-slate-700 p-1 rounded"><strong>C:</strong> {log.nutrition.macronutrients.carbohydrates}g</div>
                                        <div className="bg-slate-700 p-1 rounded"><strong>F:</strong> {log.nutrition.macronutrients.fat}g</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    !isLoading && <p className="text-center text-slate-400 py-6 text-sm">You haven't logged any meals today.</p>
                )}
            </div>
        </section>
    );
};