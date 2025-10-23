// __tests__/services/firestoreService.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { db, storage } from '../../firebase';
import * as firestoreService from '../../services/firestoreService';
import firebase from 'firebase/compat/app';

// Mock the entire firebase dependency
jest.mock('../../firebase', () => {
    const firestore = {
        collection: jest.fn(),
        FieldValue: {
            serverTimestamp: jest.fn(() => 'mock_timestamp'),
            increment: jest.fn(val => `increment(${val})`),
        },
         Timestamp: {
            fromDate: (date: Date) => ({ toDate: () => date, _isMock: true }),
        },
    };
    
    return {
        db: {
            collection: firestore.collection,
        },
        storage: {
            ref: jest.fn(),
        },
        // This structure allows us to access firebase.firestore.FieldValue in the service file
        firebase: {
            firestore: {
                FieldValue: firestore.FieldValue,
                Timestamp: firestore.Timestamp,
            },
        },
    };
});

// Create mock functions with correct chaining for cleaner tests
const mockCollection = db.collection as jest.Mock;
const mockStorageRef = storage.ref as jest.Mock;
const { firebase: mockedFirebase } = require('../../firebase');
const mockFieldValue = mockedFirebase.firestore.FieldValue;

describe('firestoreService', () => {
    // Mocks for chained calls that can be reset
    const mockAdd = jest.fn();
    const mockSet = jest.fn();
    const mockUpdate = jest.fn();
    const mockDocGet = jest.fn();
    const mockCollectionGet = jest.fn();
    const mockWhere = jest.fn();
    const mockOrderBy = jest.fn();
    const mockLimit = jest.fn();
    
    const mockDoc = jest.fn(() => ({
        get: mockDocGet,
        set: mockSet,
        update: mockUpdate,
        collection: jest.fn(() => ({
            add: mockAdd,
            where: mockWhere,
        })),
    }));

    beforeEach(() => {
        jest.clearAllMocks();
        
        // This object represents the result of any query-building method like where, orderBy, etc.
        const queryChaining = {
            where: mockWhere,
            orderBy: mockOrderBy,
            limit: mockLimit,
            get: mockCollectionGet,
        };

        // Ensure that calling a query method returns the same chaining object,
        // allowing for multiple calls like .where().where()
        mockWhere.mockReturnValue(queryChaining);
        mockOrderBy.mockReturnValue(queryChaining);
        mockLimit.mockReturnValue(queryChaining);

        // The top-level collection can also have query methods
        mockCollection.mockReturnValue({
            doc: mockDoc,
            where: mockWhere,
            orderBy: mockOrderBy, // Add orderBy here for getTodaysMealLogs
            get: mockCollectionGet,
        });
        
        // Mock for storage
        // FIX: Cast resolved value to 'any' to satisfy TypeScript's strict type checking for mocks.
        const mockPut = jest.fn().mockResolvedValue({
            ref: { getDownloadURL: jest.fn().mockResolvedValue('http://mock-url.com/image.jpg') },
        } as any);
        mockStorageRef.mockReturnValue({ put: mockPut });

        // A small hack to replace the mocked Date.now in uploadImage with a static value for predictable paths
        jest.spyOn(Date, 'now').mockImplementation(() => 1234567890);
    });

    describe('uploadImage', () => {
        it('should upload an image and return the download URL', async () => {
            const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
            const url = await firestoreService.uploadImage(file, 'user123');
            expect(mockStorageRef).toHaveBeenCalledWith('users/user123/meals/1234567890-test.jpg');
            expect(url).toBe('http://mock-url.com/image.jpg');
        });
    });

    describe('saveMealLog', () => {
        it('should save meal log data to the correct user subcollection', async () => {
            // FIX: Cast resolved value to 'any' to satisfy TypeScript's strict type checking for mocks.
            mockAdd.mockResolvedValue({ id: 'newLogId' } as any);
            const mealData = { imageUrl: 'url', foodItems: ['apple'], nutrition: {} as any };
            await firestoreService.saveMealLog('user123', mealData);
            expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
                ...mealData,
                createdAt: 'mock_timestamp',
            }));
        });
    });

    describe('getTodaysMealLogs', () => {
        it('should query for meal logs within the correct date range', async () => {
            // FIX: Cast resolved value to 'any' to satisfy TypeScript's strict type checking for mocks.
            mockCollectionGet.mockResolvedValue({
                docs: [{ id: 'log1', data: () => ({ foodItems: ['banana'] }) }],
            } as any);
            const logs = await firestoreService.getTodaysMealLogs('user123');
            expect(mockWhere).toHaveBeenCalledWith('createdAt', '>=', expect.objectContaining({ _isMock: true }));
            expect(mockWhere).toHaveBeenCalledWith('createdAt', '<', expect.objectContaining({ _isMock: true }));
            expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
            expect(logs).toHaveLength(1);
            expect(logs[0].id).toBe('log1');
        });
    });
    
    describe('saveWorkoutPlan', () => {
        it('should save workout plan data to the correct user subcollection', async () => {
            // FIX: Cast resolved value to 'any' to satisfy TypeScript's strict type checking for mocks.
            mockAdd.mockResolvedValue({ id: 'newPlanId' } as any);
            const plan = [{ day: 'Day 1', exercises: [] }];
            await firestoreService.saveWorkoutPlan('user123', plan, 'dumbbells');
            expect(mockAdd).toHaveBeenCalledWith({
                plan,
                basedOnEquipment: 'dumbbells',
                createdAt: 'mock_timestamp',
            });
        });
    });

    describe('exerciseExists', () => {
        it('should return true if an exercise exists', async () => {
            // FIX: Provide a more complete mock for QuerySnapshot to satisfy TypeScript.
            mockCollectionGet.mockResolvedValue({ empty: false, docs: [{ id: 'doc1', data: () => ({ name_normalized: 'barbell squat' }) }] } as any);
            const exists = await firestoreService.exerciseExists('barbell squat');
            expect(mockWhere).toHaveBeenCalledWith("name_normalized", "==", "barbell squat");
            expect(exists).toBe(true);
        });

        it('should return false if an exercise does not exist', async () => {
            // FIX: Provide a more complete mock for QuerySnapshot to satisfy TypeScript.
            mockCollectionGet.mockResolvedValue({ empty: true, docs: [] } as any);
            const exists = await firestoreService.exerciseExists('non-existent');
            expect(exists).toBe(false);
        });
    });

    describe('saveCommunityExercise', () => {
        it('should save a new exercise with a normalized name', async () => {
            const exercise = { id: 'test_id', name: 'Test Exercise' } as any;
            await firestoreService.saveCommunityExercise(exercise);
            expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
                name_normalized: 'test exercise'
            }));
        });
    });

    describe('getCommunityExercises', () => {
        it('should retrieve and map all community exercises', async () => {
            // FIX: Cast resolved value to 'any' to satisfy TypeScript's strict type checking for mocks.
            mockCollectionGet.mockResolvedValue({
                docs: [
                    { data: () => ({ name: 'Community Squat' }) },
                    { data: () => ({ name: 'Community Bench' }) },
                ]
            } as any);
            const exercises = await firestoreService.getCommunityExercises();
            expect(exercises).toHaveLength(2);
            expect(exercises[0].name).toBe('Community Squat');
        });
    });

    describe('createUserProfile', () => {
        it('should create a profile if one does not exist', async () => {
            // FIX: Provide a more complete mock for DocumentSnapshot to satisfy TypeScript.
            mockDocGet.mockResolvedValue({ exists: false, data: () => undefined } as any);
            const user = { uid: 'newUser', email: 'new@user.com' } as firebase.User;
            await firestoreService.createUserProfile(user);
            expect(mockDocGet).toHaveBeenCalled();
            expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
                displayName: 'new'
            }));
        });

        it('should not create a profile if one already exists', async () => {
            // FIX: Provide a more complete mock for DocumentSnapshot to satisfy TypeScript.
            mockDocGet.mockResolvedValue({ exists: true, data: () => ({ displayName: 'test' }) } as any);
            const user = { uid: 'existingUser', email: 'existing@user.com' } as firebase.User;
            await firestoreService.createUserProfile(user);
            expect(mockDocGet).toHaveBeenCalled();
            expect(mockSet).not.toHaveBeenCalled();
        });
    });

    describe('getUserProfile', () => {
        it('should return a user profile if found', async () => {
            const profileData = { uid: 'user123', displayName: 'Test' };
            // FIX: Cast resolved value to 'any' to satisfy TypeScript's strict type checking for mocks.
            mockDocGet.mockResolvedValue({ exists: true, data: () => profileData } as any);
            const profile = await firestoreService.getUserProfile('user123');
            expect(profile).toEqual(profileData);
        });

        it('should return null if no user profile is found', async () => {
            // FIX: Provide a more complete mock for DocumentSnapshot to satisfy TypeScript.
            mockDocGet.mockResolvedValue({ exists: false, data: () => undefined } as any);
            const profile = await firestoreService.getUserProfile('nonexistentUser');
            expect(profile).toBeNull();
        });
    });
    
    describe('awardPointsToUser', () => {
        it('should call update with FieldValue.increment', async () => {
            await firestoreService.awardPointsToUser('user123', 5);
            expect(mockUpdate).toHaveBeenCalledWith({
                points: mockFieldValue.increment(5)
            });
        });
    });
});