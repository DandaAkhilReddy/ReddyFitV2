import React, { useState, useCallback, useRef, useEffect } from 'react';
// Fix: Use firebase.User type from compat library
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { extractFramesFromVideo } from '../utils/frameExtractor';
import { analyzeVideoWithFrames, generateWorkoutPlan, WorkoutPlan, Exercise, findYouTubeVideoForExercise } from '../services/geminiService';
import * as firestoreService from '../services/firestoreService';
import { exercises as baseExercises, Exercise as LibraryExercise } from '../data/exercises';
import * as dbService from '../database/dbService';
import { useToast } from '../hooks/useToast';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { Loader } from './shared/Loader';
import { ErrorMessage } from './shared/ErrorMessage';
import { UploadIcon, PlayIcon, RefreshIcon, ChevronDownIcon, CloseIcon, SparklesIcon } from './shared/icons';
import { renderMarkdown } from '../utils/helpers';
import { ProgressBar } from './shared/ProgressBar';

const ANALYSIS_PROMPT = `You are a world-class AI assistant with an expert eye for identifying gym and fitness equipment. Your primary goal is to meticulously analyze the provided video frames and produce a comprehensive, accurate list of all workout equipment visible. This list is critical for generating a personalized workout plan.

**CRITICAL INSTRUCTIONS:**

1.  **IDENTIFY WITH PRECISION:** Your main task is to identify and list *every single piece of exercise equipment*. Be extremely specific.
    *   **Free Weights:** Don't just say 'dumbbells'; specify if you see 'hex dumbbells', 'adjustable dumbbells', or 'round dumbbells'. Mention 'olympic barbells', 'kettlebells', 'weight plates', and 'ez-curl bars'.
    *   **Machines:** Be specific. Instead of 'cable machine', say 'dual cable crossover machine' or 'lat pulldown machine'. Identify 'leg press machine', 'smith machine', 'hack squat machine', 'treadmill', 'stationary bike', etc.
    *   **Benches & Racks:** Distinguish between a 'flat bench', 'adjustable incline bench', and 'decline bench'. Identify 'squat rack', 'power cage', or 'half rack'.
    *   **Functional/Bodyweight:** Look for 'pull-up bars', 'dip stations', 'resistance bands', 'medicine balls', 'plyo boxes', 'TRX straps'.

2.  **EXCLUDE ALL NON-EQUIPMENT:** It is vital that you *ignore* irrelevant objects. DO NOT list the following:
    *   People, their clothing, shoes, or accessories.
    *   Water bottles, towels, gym bags, phones.
    *   Reflections in mirrors.
    *   Architectural features like walls, floors, windows, lights, or mirrors themselves.

3.  **REQUIRED OUTPUT FORMAT (MARKDOWN):**
    *   Start with a heading: \`### Equipment Identified\`
    *   Below the heading, create a bulleted list (\`- \`) of every piece of equipment you identified.
    *   After the equipment list, add another heading: \`### Potential Exercises\`
    *   Below this second heading, create another bulleted list. For each piece of major equipment you found, suggest 2-3 possible exercises.`;

const GradientButton: React.FC<{onClick: () => void; disabled: boolean; children: React.ReactNode; className?: string}> = ({ onClick, disabled, children, className }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 disabled:from-amber-700/70 disabled:to-orange-800/70 disabled:cursor-not-allowed transition-all duration-300 font-semibold shadow-lg hover:shadow-amber-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-amber-400 ${className}`}
    >
        {children}
    </button>
);

const getYouTubeEmbedUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        let videoId: string | null = null;
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname.includes('youtube.com')) {
            videoId = urlObj.searchParams.get('v');
        }
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }
    } catch (error) {
        console.error("Invalid YouTube URL provided:", url, error);
    }
    return null;
};

const VideoModal: React.FC<{ exercise: LibraryExercise; onClose: () => void }> = ({ exercise, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const embedUrl = getYouTubeEmbedUrl(exercise.youtube_url);

    return (
        <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors z-10"
                    aria-label="Close"
                >
                    <CloseIcon className="w-6 h-6" />
                </button>
                 <div className="p-6 pt-12">
                     <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500 mb-4">{exercise.name}</h2>
                </div>
                {embedUrl ? (
                    <div className="w-full aspect-video bg-black">
                         <iframe
                            src={embedUrl}
                            title={`YouTube video player for ${exercise.name}`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="w-full h-full"
                        ></iframe>
                    </div>
                ) : (
                    <div className="p-6 text-center text-slate-400">Video not available for this exercise.</div>
                )}
                 <div className="p-6">
                    <div className="prose prose-invert text-slate-300 max-w-none">
                        <h3 className="text-lg font-semibold">How to Perform</h3>
                        <p className="text-sm">{exercise.description}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// New Modal for confirming new equipment
const NewEquipmentModal: React.FC<{
    equipmentName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isProcessing: boolean;
}> = ({ equipmentName, onConfirm, onCancel, isProcessing }) => (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 fade-in">
        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md p-6 text-center space-y-4">
            <SparklesIcon className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-2xl font-bold text-slate-100">New Equipment Detected!</h2>
            <p className="text-slate-300">
                Our AI agent identified <strong className="text-amber-400">{equipmentName}</strong>, which is new to our library.
                Would you like to add it to our global database and get a demo video?
            </p>
            <p className="text-xs text-slate-400">By adding it, you'll help our AI learn and earn 1 point!</p>
            <div className="flex justify-center gap-4 pt-4">
                <button onClick={onCancel} disabled={isProcessing} className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition-colors font-medium">
                    No, thanks
                </button>
                <button onClick={onConfirm} disabled={isProcessing} className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:from-green-600 hover:to-emerald-700 font-semibold">
                    {isProcessing ? 'Processing...' : 'Yes, Add It!'}
                </button>
            </div>
        </div>
    </div>
);


interface GymAnalyzerProps {
    user: firebase.User | null;
    initialVideoFile?: File | null;
    onInitialVideoConsumed?: () => void;
}

export const GymAnalyzer: React.FC<GymAnalyzerProps> = ({ user, initialVideoFile, onInitialVideoConsumed }) => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [loadingState, setLoadingState] = useState({ active: false, message: '', subtext: ''});
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
    const [equipmentList, setEquipmentList] = useState<string | null>(null);
    const [lastFailedAction, setLastFailedAction] = useState<(() => void) | null>(null);
    const [progress, setProgress] = useState(0);
    const [eta, setEta] = useState(0);
    const [extractedFrames, setExtractedFrames] = useState<string[] | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [refinementPrompt, setRefinementPrompt] = useState('');
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
    const [viewingExercise, setViewingExercise] = useState<LibraryExercise | null>(null);
    const [allExercises, setAllExercises] = useState<LibraryExercise[]>(baseExercises);

    // RAG state
    const [newlyDiscoveredItem, setNewlyDiscoveredItem] = useState<string | null>(null);
    const [isDiscovering, setIsDiscovering] = useState(false);


    const { showToast } = useToast();
    const { fitnessLevel, goal } = useUserPreferences();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const etaIntervalRef = useRef<number | null>(null);
    const progressIntervalRef = useRef<number | null>(null);

    // Fetch community exercises on load
    useEffect(() => {
        const fetchAllExercises = async () => {
            const communityExercises = await firestoreService.getCommunityExercises();
            setAllExercises(prev => [...prev, ...communityExercises]);
        };
        fetchAllExercises();
    }, []);


    const resetState = useCallback(() => {
        setVideoFile(null);
        setVideoUrl(null);
        setAnalysis(null);
        setError(null);
        setWorkoutPlan(null);
        setEquipmentList(null);
        setLastFailedAction(null);
        setProgress(0);
        setEta(0);
        setExtractedFrames(null);
        setIsRefining(false);
        setRefinementPrompt('');
        setViewingExercise(null);
        setNewlyDiscoveredItem(null);
        setIsDiscovering(false);
        if (etaIntervalRef.current) clearInterval(etaIntervalRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, []);

    useEffect(() => {
        if (initialVideoFile) {
            resetState();
            const file = new File([initialVideoFile], `recorded-video-${Date.now()}.webm`, { type: initialVideoFile.type });
            setVideoFile(file);
            setVideoUrl(URL.createObjectURL(file));
            showToast("Recorded video loaded for analysis!", "info");
            onInitialVideoConsumed?.();
        }
    }, [initialVideoFile, onInitialVideoConsumed, resetState, showToast]);

    useEffect(() => {
        dbService.initDB();
    }, []);
    
    useEffect(() => {
        if (workoutPlan && workoutPlan.length > 0) {
            setExpandedDay(workoutPlan[0].day);
        }
    }, [workoutPlan]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        resetState();
        if (file && file.type.startsWith('video/')) {
            setVideoFile(file);
            setVideoUrl(URL.createObjectURL(file));
        } else {
            showToast("Please select a valid video file.", "error");
        }
    };
    
    const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const file = event.dataTransfer.files?.[0];
        resetState();
        if (file && file.type.startsWith('video/')) {
            setVideoFile(file);
            setVideoUrl(URL.createObjectURL(file));
        } else {
            showToast("Please drop a valid video file.", "error");
        }
    }
    
    const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // RAG: Function to handle confirming a new equipment item
    const handleConfirmNewEquipment = async () => {
        if (!newlyDiscoveredItem) return;
    
        setIsDiscovering(true);
        try {
            showToast(`Searching for a demo of "${newlyDiscoveredItem}"...`, "info");
            const videoUrl = await findYouTubeVideoForExercise(newlyDiscoveredItem);
    
            const newExercise: LibraryExercise = {
                id: newlyDiscoveredItem.toLowerCase().replace(/\s+/g, '_'),
                name: newlyDiscoveredItem,
                muscle_groups: ['Varies'],
                equipment: newlyDiscoveredItem,
                difficulty: 'Intermediate',
                description: `A community-discovered piece of equipment: ${newlyDiscoveredItem}. Proper form is essential.`,
                image_url: `https://placehold.co/600x400/1e293b/f59e0b?text=${encodeURIComponent(newlyDiscoveredItem)}`,
                youtube_url: videoUrl || undefined,
            };
    
            await firestoreService.saveCommunityExercise(newExercise);
    
            // Add to local state to be available immediately
            setAllExercises(prev => [...prev, newExercise]);
    
            showToast(`"${newlyDiscoveredItem}" added to the library! You earned 1 point!`, "success");
    
        } catch (e: any) {
            showToast(`Could not process new equipment: ${e.message}`, "error");
        } finally {
            setNewlyDiscoveredItem(null);
            setIsDiscovering(false);
        }
    };


    const handleAnalyzeClick = useCallback(async () => {
        if (!videoFile) return;

        setError(null);
        setLastFailedAction(null);
        setAnalysis(null);
        setWorkoutPlan(null);
        setEquipmentList(null);
        setProgress(0);
        setExtractedFrames(null);
        
        if (etaIntervalRef.current) clearInterval(etaIntervalRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

        const ESTIMATED_FRAME_EXTRACTION_S = 22;
        const ESTIMATED_AI_ANALYSIS_S = 20;
        const totalEta = ESTIMATED_FRAME_EXTRACTION_S + ESTIMATED_AI_ANALYSIS_S;
        setEta(totalEta);
        setLoadingState({ active: true, message: 'Starting Analysis...', subtext: 'Preparing to extract video frames.' });
        
        etaIntervalRef.current = window.setInterval(() => {
            setEta(prev => Math.max(0, prev - 1));
        }, 1000);

        try {
            setLoadingState(prev => ({ ...prev, message: 'Step 1/2: Extracting Frames', subtext: 'Analyzing video content.' }));
            const frames = await extractFramesFromVideo(videoFile, 24, 24, (extractionProgress) => {
                setProgress(extractionProgress * 0.5);
            });
            setExtractedFrames(frames);
            setProgress(50);

            if (frames.length === 0) throw new Error("Could not extract any frames from the video. The file might be corrupted or in an unsupported format.");

            setLoadingState(prev => ({ ...prev, message: 'Step 2/2: AI Analysis', subtext: 'Identifying equipment with Gemini Pro.' }));
            
            let currentProgress = 50;
            progressIntervalRef.current = window.setInterval(() => {
                currentProgress += 1;
                if (currentProgress >= 95) {
                    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                }
                setProgress(currentProgress);
            }, (ESTIMATED_AI_ANALYSIS_S * 1000) / 45);

            const result = await analyzeVideoWithFrames(
                ANALYSIS_PROMPT, 
                frames,
                (attempt, maxAttempts) => {
                    setLoadingState(prev => ({ ...prev, subtext: `Model is busy. Retrying... (Attempt ${attempt + 1}/${maxAttempts})` }));
                }
            );

            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            setProgress(100);
            setAnalysis(result);
            showToast("Equipment analysis complete!", "success");

            const equipmentRegex = /###\s+Equipment Identified\s*([\s\S]*?)(?:###|$)/i;
            const equipmentMatch = result.match(equipmentRegex);
            if (equipmentMatch && equipmentMatch[1]) {
                const list = equipmentMatch[1].split('\n').map(line => line.replace(/[-*]\s*/, '').trim()).filter(Boolean);
                const equipmentString = list.join(', ');
                if (equipmentString) {
                    setEquipmentList(equipmentString);

                    // RAG: Check for new equipment
                    for (const item of list) {
                        const existsInBase = baseExercises.some(ex => ex.equipment.toLowerCase().includes(item.toLowerCase()));
                        const existsInCommunity = await firestoreService.exerciseExists(item);
                        if (!existsInBase && !existsInCommunity) {
                            setNewlyDiscoveredItem(item); // Trigger modal
                            break; // Show one modal at a time
                        }
                    }

                } else {
                    setAnalysis(result + "\n\n**Note:** I couldn't identify specific equipment to generate a plan. You can still use the analysis above for exercise ideas!");
                }
            } else {
                setAnalysis(result + "\n\n**Note:** I couldn't identify specific equipment to generate a plan. You can still use the analysis above for exercise ideas!");
            }
        } catch (e: any) {
            const friendlyMessage = e.message?.toLowerCase().includes('extract') || e.message?.toLowerCase().includes('corrupt')
                ? 'Could not process the video file. It may be corrupt or in an unsupported format. Please try a different video.'
                : `Analysis failed: ${e.message || 'An unknown error occurred.'}`;
            setError(friendlyMessage);
            showToast(friendlyMessage, "error");
            setLastFailedAction(() => handleAnalyzeClick);
        } finally {
            if (etaIntervalRef.current) clearInterval(etaIntervalRef.current);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            setLoadingState({ active: false, message: '', subtext: '' });
            setTimeout(() => setProgress(0), 1000);
        }
    }, [videoFile, showToast]);

    const handleRefineAnalysis = useCallback(async () => {
        if (!extractedFrames || !refinementPrompt.trim()) return;
    
        setError(null);
        setLastFailedAction(null);
        setWorkoutPlan(null);
        setEquipmentList(null);
        
        setLoadingState({ active: true, message: 'Refining Analysis...', subtext: 'Applying your instructions to get a better result.' });
        
        try {
            const refinedPrompt = `
                ${ANALYSIS_PROMPT}
    
                ---
                **IMPORTANT USER REFINEMENT:** The user has provided new instructions. Follow them carefully to refine the initial analysis.
    
                **User's Instructions:** "${refinementPrompt}"
    
                Based on these new instructions, re-analyze the provided video frames and generate an updated list of equipment and potential exercises.
                ---
            `;
    
            const result = await analyzeVideoWithFrames(
                refinedPrompt,
                extractedFrames,
                (attempt, maxAttempts) => {
                    setLoadingState(prev => ({ ...prev, subtext: `Model is busy. Retrying... (Attempt ${attempt + 1}/${maxAttempts})` }));
                }
            );
            
            setAnalysis(result);
            showToast("Analysis refined successfully!", "success");
    
            const equipmentRegex = /###\s+Equipment Identified\s*([\s\S]*?)(?:###|$)/i;
            const equipmentMatch = result.match(equipmentRegex);
            if (equipmentMatch && equipmentMatch[1]) {
                const list = equipmentMatch[1].split('\n').map(line => line.replace(/[-*]\s*/, '').trim()).filter(Boolean);
                const equipmentString = list.join(', ');
                if (equipmentString) {
                    setEquipmentList(equipmentString);
                } else {
                     setAnalysis(result + "\n\n**Note:** I couldn't identify specific equipment to generate a plan based on your refinement.");
                }
            } else {
                setAnalysis(result + "\n\n**Note:** I couldn't identify specific equipment to generate a plan based on your refinement.");
            }
    
        } catch (e: any) {
             const errorMessage = e.message || 'The refinement failed. The AI might be busy or unable to process the request. Please try again.';
            setError(errorMessage);
            showToast(errorMessage, "error");
            setLastFailedAction(() => handleRefineAnalysis);
        } finally {
            setLoadingState({ active: false, message: '', subtext: '' });
            setIsRefining(false);
            setRefinementPrompt('');
        }
    }, [extractedFrames, refinementPrompt, showToast]);


    const generatePlan = useCallback(async (isRegeneration = false) => {
        if (!equipmentList) return;
        
        const message = isRegeneration ? 'Generating New Plan...' : 'Generating Personalized Plan...';
        const subtext = isRegeneration ? 'Asking the AI for a fresh variation of your workout.' : `Crafting a plan for a ${fitnessLevel} user to ${goal}.`;
        
        setLoadingState({ active: true, message, subtext });
        setError(null);
        setLastFailedAction(null);
        if (!isRegeneration) {
            setWorkoutPlan(null);
        }
        
        const cacheKey = `${equipmentList}-${fitnessLevel}-${goal}`;

        try {
            // For logged-out users, check local IndexedDB
            if (!user && !isRegeneration) {
                const cachedPlan = await dbService.get<WorkoutPlan>('workoutPlans', cacheKey);
                if (cachedPlan) {
                    setWorkoutPlan(cachedPlan);
                    showToast("Loaded a saved workout plan for this profile.", "info");
                    return;
                }
            }

            const plan = await generateWorkoutPlan(equipmentList, fitnessLevel, goal, (attempt, maxAttempts) => {
                 setLoadingState(prev => ({ ...prev, subtext: `Model is busy. Retrying... (Attempt ${attempt + 1}/${maxAttempts})` }));
            }, isRegeneration);
            setWorkoutPlan(plan);
            
            // Save to Firestore for logged-in users, or IndexedDB for guests
            if (user) {
                await firestoreService.saveWorkoutPlan(user.uid, plan, equipmentList);
                 showToast(isRegeneration ? "New workout plan generated and saved to your profile!" : "Personalized workout plan generated and saved to your profile!", "success");
            } else {
                await dbService.set('workoutPlans', cacheKey, plan);
                showToast(isRegeneration ? "New workout plan generated!" : "Personalized workout plan generated and saved!", "success");
            }


        } catch (e: any) {
            const errorMessage = e.message || 'The workout plan could not be generated. This is likely a temporary issue. Please try again in a moment.';
            setError(errorMessage);
            showToast(errorMessage, "error");
            setLastFailedAction(() => () => generatePlan(isRegeneration));
        } finally {
            setLoadingState({ active: false, message: '', subtext: '' });
        }
    }, [equipmentList, fitnessLevel, goal, showToast, user]);

    const handleGeneratePlanClick = () => generatePlan(false);
    const handleRegeneratePlanClick = () => generatePlan(true);

    return (
        <section className="space-y-6">
             <header className="mb-4 text-center">
                <h1 className="text-2xl font-bold text-slate-100">Gym Analyzer</h1>
                <p className="text-sm text-slate-400">Upload a video of your gym to get a personalized workout plan.</p>
            </header>
            {viewingExercise && <VideoModal exercise={viewingExercise} onClose={() => setViewingExercise(null)} />}
             {newlyDiscoveredItem && (
                <NewEquipmentModal
                    equipmentName={newlyDiscoveredItem}
                    onConfirm={handleConfirmNewEquipment}
                    onCancel={() => setNewlyDiscoveredItem(null)}
                    isProcessing={isDiscovering}
                />
            )}
            <div className="bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700">
                {!videoFile ? (
                     <label 
                        onDrop={handleDrop} 
                        onDragOver={handleDragOver}
                        htmlFor="video-upload" 
                        className="flex flex-col items-center justify-center w-full h-56 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800/50 hover:bg-slate-700/50 hover:border-amber-500 transition-all duration-300 group"
                    >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                            <UploadIcon />
                            <p className="mb-2 text-sm text-slate-300"><span className="font-semibold text-amber-400">Tap to upload</span> or drag & drop</p>
                            <p className="text-xs text-slate-500">MP4, MOV, etc.</p>
                        </div>
                        <input id="video-upload" ref={fileInputRef} type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
                    </label>
                ) : (
                    <div className="flex flex-col items-center space-y-4">
                       <video src={videoUrl ?? ''} controls className="w-full rounded-lg shadow-lg border border-slate-700"></video>
                       <div className="flex flex-col sm:flex-row w-full gap-3">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition-colors font-medium"
                        >
                            Change Video
                        </button>
                        <GradientButton
                            onClick={handleAnalyzeClick}
                            disabled={loadingState.active}
                            className="w-full"
                        >
                            {loadingState.active ? 'Processing...' : 'Analyze Equipment'}
                        </GradientButton>
                       </div>
                    </div>
                )}
            </div>

            {error && <ErrorMessage error={error} onRetry={lastFailedAction ? () => { setError(null); lastFailedAction(); } : undefined} />}

            {loadingState.active && (
                <div className="flex flex-col items-center gap-4 my-4 fade-in">
                    <Loader text={loadingState.message} subtext={loadingState.subtext} />
                    <div className="w-full max-w-md">
                        <ProgressBar progress={progress} />
                        <p className="text-center text-sm text-slate-400 mt-2">
                            ETA: {eta} seconds
                        </p>
                    </div>
                </div>
            )}

            {analysis && !loadingState.active && (
                <div className="bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700 prose prose-invert fade-in">
                     <div dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }} />

                    <div className="mt-6 not-prose">
                        {!isRefining ? (
                            <div className="text-center border-t border-slate-700 pt-4">
                                <button
                                    onClick={() => setIsRefining(true)}
                                    className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition-colors font-medium text-sm"
                                >
                                    Refine Analysis
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700 fade-in">
                                <label htmlFor="refinement-prompt" className="block text-sm font-medium text-slate-300">
                                    Refinement Instructions
                                </label>
                                <input
                                    id="refinement-prompt"
                                    type="text"
                                    value={refinementPrompt}
                                    onChange={(e) => setRefinementPrompt(e.target.value)}
                                    placeholder="e.g., focus more on free weights"
                                    className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-2.5"
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => setIsRefining(false)} className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition-colors font-medium text-sm">Cancel</button>
                                    <GradientButton
                                        onClick={handleRefineAnalysis}
                                        disabled={!refinementPrompt.trim() || loadingState.active}
                                        className="px-4 py-2 text-sm"
                                    >
                                        Submit
                                    </GradientButton>
                                </div>
                            </div>
                        )}
                    </div>

                    {equipmentList && !isRefining && !workoutPlan && (
                        <div className="text-center mt-6 not-prose">
                             <button
                                onClick={handleGeneratePlanClick}
                                disabled={loadingState.active}
                                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:from-green-600 hover:to-emerald-700 disabled:from-green-700/70 disabled:to-emerald-800/70 disabled:cursor-not-allowed transition-all duration-300 font-semibold shadow-lg hover:shadow-green-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-green-400"
                            >
                                {loadingState.active ? 'Generating...' : 'Generate My Workout Plan'}
                            </button>
                        </div>
                    )}
                </div>
            )}
            
            {workoutPlan && !loadingState.active && (
                <div className="bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700 fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                         <h2 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">Your Workout Plan</h2>
                        <button
                            onClick={handleRegeneratePlanClick}
                            disabled={loadingState.active}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition-colors font-medium text-xs disabled:bg-slate-700 disabled:cursor-not-allowed"
                        >
                            <RefreshIcon className={`w-4 h-4 ${loadingState.active ? 'animate-spin' : ''}`} />
                           {loadingState.active ? 'Generating...' : 'New Plan'}
                        </button>
                    </div>
                    <div className="space-y-3">
                        {workoutPlan.map(day => (
                             <div key={day.day} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                                <button
                                    onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                                    className="w-full flex justify-between items-center p-4 text-left"
                                >
                                    <h3 className="font-bold text-lg text-amber-300 tracking-wide">{day.day}</h3>
                                    <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expandedDay === day.day ? 'rotate-180' : ''}`} />
                                </button>
                                <div className={`transition-all duration-500 ease-in-out ${expandedDay === day.day ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <ul className="space-y-3 p-4 pt-0">
                                        {day.exercises.map(exercise => {
                                            const exerciseDetails = allExercises.find(e => e.name.toLowerCase() === exercise.name.toLowerCase());
                                            return (
                                                <li key={exercise.name} className="flex flex-col justify-between items-start p-3 bg-slate-900/70 rounded-lg">
                                                    <div>
                                                        <span className="font-semibold text-md text-slate-100">{exercise.name}</span>
                                                        <span className="text-sm text-slate-400 block mt-1">{exercise.sets} sets of {exercise.reps} reps</span>
                                                    </div>
                                                    <div className="mt-3 w-full">
                                                         {exerciseDetails?.youtube_url ? (
                                                            <button
                                                                onClick={() => exerciseDetails && setViewingExercise(exerciseDetails)}
                                                                className="flex w-full justify-center items-center text-sm px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-blue-500/30"
                                                            >
                                                                <PlayIcon className="w-4 h-4 mr-1.5" />
                                                                View Demo
                                                            </button>
                                                         ) : (
                                                            <button
                                                                disabled
                                                                className="flex w-full justify-center items-center text-sm px-4 py-2 bg-slate-700 text-slate-500 rounded-md font-semibold cursor-not-allowed"
                                                            >
                                                                <PlayIcon className="w-4 h-4 mr-1.5" />
                                                                Demo Unavailable
                                                            </button>
                                                         )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};