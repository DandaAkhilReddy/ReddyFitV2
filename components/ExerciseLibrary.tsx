import React, { useState, useMemo, useEffect } from 'react';
import { exercises as baseExercises, Exercise } from '../data/exercises';
import { getCommunityExercises } from '../services/firestoreService';
import { LibraryIcon, CloseIcon } from './shared/icons';

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


const ExerciseModal: React.FC<{ exercise: Exercise; onClose: () => void }> = ({ exercise, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const imageUrl = useMemo(() => {
        if (exercise.image_url) {
            return exercise.image_url;
        }
        console.warn(`Warning: Exercise '${exercise.name}' (ID: ${exercise.id}) is missing an image_url. Using placeholder in modal.`);
        return `https://placehold.co/600x400/1e293b/f59e0b?text=${encodeURIComponent(exercise.name)}`;
    }, [exercise]);
    
    const embedUrl = getYouTubeEmbedUrl(exercise.youtube_url);

    return (
        <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto relative"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors z-10"
                    aria-label="Close"
                >
                    <CloseIcon className="w-6 h-6" />
                </button>

                {embedUrl ? (
                    <div className="w-full aspect-video rounded-t-lg overflow-hidden bg-black">
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
                    <img src={imageUrl} alt={exercise.name} className="w-full h-48 object-cover rounded-t-lg" />
                )}
                
                <div className="p-4">
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500 mb-3">{exercise.name}</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {exercise.muscle_groups.map(group => (
                            <span key={group} className="px-2 py-0.5 text-xs font-semibold text-amber-200 bg-amber-800/50 rounded-full">{group}</span>
                        ))}
                         <span className="px-2 py-0.5 text-xs font-semibold text-cyan-200 bg-cyan-800/50 rounded-full">{exercise.difficulty}</span>
                         <span className="px-2 py-0.5 text-xs font-semibold text-slate-200 bg-slate-600 rounded-full">{exercise.equipment}</span>
                    </div>
                    <div className="prose prose-invert text-slate-300 max-w-none text-sm">
                        <h3 className="text-lg font-semibold">How to Perform</h3>
                        <p>{exercise.description}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};


export const ExerciseLibrary: React.FC = () => {
    const [allExercises, setAllExercises] = useState<Exercise[]>(baseExercises);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMuscle, setSelectedMuscle] = useState('All');
    const [selectedDifficulty, setSelectedDifficulty] = useState('All');
    const [selectedEquipment, setSelectedEquipment] = useState('All');
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

    useEffect(() => {
        const fetchAllExercises = async () => {
            try {
                const communityExercises = await getCommunityExercises();
                // Combine and remove duplicates, giving precedence to base exercises
                const combined = [...baseExercises, ...communityExercises];
                const uniqueExercises = Array.from(new Map(combined.map(ex => [ex.id, ex])).values());
                setAllExercises(uniqueExercises);
            } catch (error) {
                console.error("Failed to fetch community exercises:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllExercises();
    }, []);

    const { muscleGroups, difficulties, equipments } = useMemo(() => {
        const muscleGroups = Array.from(new Set(allExercises.flatMap(e => e.muscle_groups))).sort();
        const difficulties = Array.from(new Set(allExercises.map(e => e.difficulty))).sort();
        const equipments = Array.from(new Set(allExercises.map(e => e.equipment))).sort();
        return { muscleGroups, difficulties, equipments };
    }, [allExercises]);


    const filteredExercises = useMemo(() => {
        return allExercises.filter(exercise => {
            const nameMatch = exercise.name.toLowerCase().includes(searchTerm.toLowerCase());
            const muscleMatch = selectedMuscle === 'All' || exercise.muscle_groups.includes(selectedMuscle);
            const difficultyMatch = selectedDifficulty === 'All' || exercise.difficulty === selectedDifficulty;
            const equipmentMatch = selectedEquipment === 'All' || exercise.equipment === selectedEquipment;
            return nameMatch && muscleMatch && difficultyMatch && equipmentMatch;
        });
    }, [allExercises, searchTerm, selectedMuscle, selectedDifficulty, selectedEquipment]);

    return (
        <>
            <section className="bg-slate-800/50 p-4 rounded-lg shadow-xl border border-slate-700 space-y-6">
                 <header className="text-center">
                    <h1 className="text-2xl font-bold text-slate-100">Exercise Library</h1>
                    <p className="text-sm text-slate-400">Browse and search for exercises.</p>
                </header>

                {/* Filters */}
                <div className="space-y-3">
                     <input
                        type="text"
                        placeholder="Search exercises..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-3"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                            value={selectedMuscle}
                            onChange={(e) => setSelectedMuscle(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-2.5"
                        >
                            <option value="All">All Muscles</option>
                            {muscleGroups.map(group => <option key={group} value={group}>{group}</option>)}
                        </select>
                        <select
                            value={selectedDifficulty}
                            onChange={(e) => setSelectedDifficulty(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-2.5"
                        >
                            <option value="All">All Difficulties</option>
                            {difficulties.map(diff => <option key={diff} value={diff}>{diff}</option>)}
                        </select>
                         <select
                            value={selectedEquipment}
                            onChange={(e) => setSelectedEquipment(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-2.5"
                        >
                            <option value="All">All Equipment</option>
                            {equipments.map(equip => <option key={equip} value={equip}>{equip}</option>)}
                        </select>
                    </div>
                </div>

                {/* Exercise Grid */}
                {isLoading ? (
                    <div className="text-center py-10"><p>Loading exercises...</p></div>
                ) : filteredExercises.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                        {filteredExercises.map(exercise => {
                            const imageUrl = exercise.image_url || `https://placehold.co/600x400/1e293b/f59e0b?text=${encodeURIComponent(exercise.name)}`;
                            if (!exercise.image_url) {
                                console.warn(`Warning: Exercise '${exercise.name}' (ID: ${exercise.id}) is missing an image_url. Using placeholder in grid.`);
                            }
                            return (
                                <button
                                    key={exercise.id}
                                    onClick={() => setSelectedExercise(exercise)}
                                    className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-amber-500 transition-all duration-300 group text-left focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    <img src={imageUrl} alt={exercise.name} className="h-28 w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    <div className="p-3">
                                        <h3 className="font-semibold text-sm text-slate-100 truncate">{exercise.name}</h3>
                                        <p className="text-xs text-amber-400">{exercise.muscle_groups[0]}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10">
                         <LibraryIcon className="w-12 h-12 text-slate-600 mx-auto mb-3"/>
                         <h3 className="text-lg font-semibold text-slate-300">No Exercises Found</h3>
                         <p className="text-slate-500 mt-1 text-sm">Try adjusting your search or filters.</p>
                    </div>
                )}
            </section>
            
            {selectedExercise && <ExerciseModal exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />}
        </>
    );
};