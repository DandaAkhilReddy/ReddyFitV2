// Fix: Use the v8 compat API to match the rest of the project setup.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { db, storage } from '../firebase';
import { NutritionalInfo, WorkoutPlan } from './geminiService';
import { Exercise as LibraryExercise } from '../data/exercises';

export interface MealLog {
    id: string;
    userId: string;
    createdAt: firebase.firestore.Timestamp;
    imageUrl: string;
    foodItems: string[];
    nutrition: NutritionalInfo;
}

export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    createdAt: firebase.firestore.Timestamp;
    points: number;
}


/**
 * Uploads an image file to Firebase Storage.
 * @param file The image file to upload.
 * @param userId The ID of the user uploading the file.
 * @returns A promise that resolves with the public URL of the uploaded image.
 */
export const uploadImage = async (file: File, userId: string): Promise<string> => {
    const filePath = `users/${userId}/meals/${Date.now()}-${file.name}`;
    const storageRef = storage.ref(filePath);
    const snapshot = await storageRef.put(file);
    return await snapshot.ref.getDownloadURL();
};

/**
 * Saves a meal log to Firestore for a specific user.
 * @param userId The ID of the user.
 * @param mealData The data for the meal log.
 */
export const saveMealLog = async (
    userId: string,
    mealData: { imageUrl: string; foodItems: string[]; nutrition: NutritionalInfo }
): Promise<void> => {
    const mealLogsCollection = db.collection('users').doc(userId).collection('mealLogs');
    await mealLogsCollection.add({
        ...mealData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
};

/**
 * Fetches today's meal logs for a specific user from Firestore.
 * @param userId The ID of the user.
 * @returns A promise that resolves with an array of today's meal logs.
 */
export const getTodaysMealLogs = async (userId: string): Promise<MealLog[]> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Start of tomorrow

    const mealLogsCollection = db.collection('users').doc(userId).collection('mealLogs');
    const q = mealLogsCollection
        .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(today))
        .where('createdAt', '<', firebase.firestore.Timestamp.fromDate(tomorrow))
        .orderBy('createdAt', 'desc');

    const querySnapshot = await q.get();
    return querySnapshot.docs.map(doc => ({ id: doc.id, userId, ...doc.data() } as MealLog));
};

/**
 * Saves a generated workout plan to Firestore for a specific user.
 * @param userId The ID of the user.
 * @param plan The workout plan object.
 * @param basedOnEquipment A string listing the equipment the plan is based on.
 */
export const saveWorkoutPlan = async (
    userId: string,
    plan: WorkoutPlan,
    basedOnEquipment: string
): Promise<void> => {
     const workoutPlansCollection = db.collection('users').doc(userId).collection('workoutPlans');
     await workoutPlansCollection.add({
        plan,
        basedOnEquipment,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
     });
};


/**
 * Checks if an exercise already exists in the community collection.
 * @param exerciseName The name of the exercise to check.
 * @returns A promise that resolves to true if the exercise exists, false otherwise.
 */
export const exerciseExists = async (exerciseName: string): Promise<boolean> => {
    const normalizedName = exerciseName.toLowerCase().trim();
    const q = db.collection("community_exercises")
        .where("name_normalized", "==", normalizedName)
        .limit(1);
    const querySnapshot = await q.get();
    return !querySnapshot.empty;
};

/**
 * Saves a new community-discovered exercise to Firestore.
 * @param exercise The exercise data to save.
 */
export const saveCommunityExercise = async (exercise: LibraryExercise): Promise<void> => {
    const exerciseRef = db.collection("community_exercises").doc(exercise.id);
    await exerciseRef.set({
        ...exercise,
        name_normalized: exercise.name.toLowerCase().trim(),
        discoveredBy: 'community',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
};

/**
 * Retrieves all community-contributed exercises from Firestore.
 * @returns A promise resolving to an array of exercises.
 */
export const getCommunityExercises = async (): Promise<LibraryExercise[]> => {
    const querySnapshot = await db.collection("community_exercises").get();
    return querySnapshot.docs.map(doc => doc.data() as LibraryExercise);
};

/**
 * Creates a new user profile document in Firestore upon sign-up.
 * @param user The Firebase user object from authentication.
 */
export const createUserProfile = async (user: firebase.User): Promise<void> => {
    const userRef = db.collection('users').doc(user.uid);
    const docSnap = await userRef.get();

    if (!docSnap.exists) {
        await userRef.set({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email?.split('@')[0] || 'New User',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            points: 0, // Initialize points
        });
    }
};

/**
 * Retrieves a user's profile from Firestore.
 * @param uid The user's unique ID.
 * @returns A promise that resolves with the user profile, or null if not found.
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    const userRef = db.collection('users').doc(uid);
    const docSnap = await userRef.get();
    if (docSnap.exists) {
        return docSnap.data() as UserProfile;
    }
    console.warn(`No profile found for user with UID: ${uid}`);
    return null;
};

/**
 * Awards a specified number of points to a user.
 * @param uid The user's unique ID.
 * @param points The number of points to award.
 */
export const awardPointsToUser = async (uid: string, points: number): Promise<void> => {
    const userRef = db.collection('users').doc(uid);
    await userRef.update({
        points: firebase.firestore.FieldValue.increment(points)
    });
};