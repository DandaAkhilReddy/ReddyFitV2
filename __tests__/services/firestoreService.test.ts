// __tests__/services/firestoreService.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { db, storage } from '../../firebase';
import * as firestoreService from '../../services/firestoreService';
import { UserProfile } from '../../services/firestoreService';
import firebase from 'firebase/compat/app';

// Mock the entire firebase dependency
jest.mock('../../firebase', () => {
    // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
    const mockDb = {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                collection: jest.fn(() => ({
                    add: jest.fn().mockResolvedValue({ id: 'newDocId' }),
                    where: jest.fn(() => ({
                        where: jest.fn(() => ({
                            orderBy: jest.fn(() => ({
                                get: jest.fn().mockResolvedValue({ docs: [] }),
                            })),
                        })),
                        limit: jest.fn(() => ({
                            get: jest.fn().mockResolvedValue({ empty: true }),
                        })),
                    })),
                })),
                get: jest.fn().mockResolvedValue({ exists: false }),
                set: jest.fn().mockResolvedValue(undefined),
                update: jest.fn().mockResolvedValue(undefined),
            })),
            where: jest.fn(() => ({
                limit: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ empty: true }),
                })),
            })),
            get: jest.fn().mockResolvedValue({ docs: [] }),
        })),
    };

    const mockStorage = {
        ref: jest.fn(() => ({
            put: jest.fn().mockResolvedValue({
                ref: {
                    getDownloadURL: jest.fn().mockResolvedValue('http://mock-url.com/image.jpg'),
                },
            }),
        })),
    };

    // Mock FieldValue for increment
    const mockFieldValue = {
        serverTimestamp: jest.fn(() => 'mock_timestamp'),
        increment: jest.fn(val => `increment(${val})`),
    };
    
    // We need to access firebase.firestore.Timestamp and firebase.firestore.FieldValue
    // so we mock the top-level firebase object.
    return {
        db: mockDb,
        storage: mockStorage,
        // This is a bit of a trick to allow the static properties to be mocked
        firebase: {
            firestore: {
                Timestamp: {
                    fromDate: (date: Date) => ({ toDate: () => date }),
                },
                FieldValue: mockFieldValue,
            }
        }
    };
});


// Because of the above trick, we need to import firebase differently here
const { firebase: mockedFirebase } = require('../../firebase');

const mockDb = db as any;
const mockStorage = storage as any;
const mockFieldValue = mockedFirebase.firestore.FieldValue;

describe('firestoreService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('uploadImage', () => {
        it('should upload an image and return the download URL', async () => {
            const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
            const url = await firestoreService.uploadImage(file, 'user123');
            // Fix: Update expectation to use the numeric timestamp from the mocked Date.now().
            expect(mockStorage.ref).toHaveBeenCalledWith('users/user123/meals/1234567890-test.jpg');
            expect(url).toBe('http://mock-url.com/image.jpg');
        });
    });

    describe('saveMealLog', () => {
        it('should save meal log data to the correct user subcollection', async () => {
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const addMock = jest.fn().mockResolvedValue({ id: 'newLogId' });
            mockDb.collection.mockReturnValue({ doc: () => ({ collection: () => ({ add: addMock }) }) });

            const mealData = { imageUrl: 'url', foodItems: ['apple'], nutrition: {} as any };
            await firestoreService.saveMealLog('user123', mealData);

            expect(addMock).toHaveBeenCalledWith(expect.objectContaining({
                ...mealData,
                createdAt: expect.any(String), // serverTimestamp mock
            }));
        });
    });

    describe('getTodaysMealLogs', () => {
        it('should query for meal logs within the correct date range', async () => {
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const getMock = jest.fn().mockResolvedValue({
                docs: [
                    { id: 'log1', data: () => ({ foodItems: ['banana'] }) },
                ],
            });
            // Fix: Correctly mock chained .where() calls.
            const orderByMock = jest.fn(() => ({ get: getMock }));
            const whereMock = jest.fn();
            whereMock.mockImplementation(() => ({ where: whereMock, orderBy: orderByMock }));
            mockDb.collection.mockReturnValue({ doc: () => ({ collection: () => ({ where: whereMock }) }) });
            
            const logs = await firestoreService.getTodaysMealLogs('user123');
            
            expect(whereMock).toHaveBeenCalledTimes(2); // Called for >= today and < tomorrow
            expect(orderByMock).toHaveBeenCalledWith('createdAt', 'desc');
            expect(logs).toHaveLength(1);
            expect(logs[0].id).toBe('log1');
        });
    });
    
    describe('saveWorkoutPlan', () => {
        it('should save workout plan data to the correct user subcollection', async () => {
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const addMock = jest.fn().mockResolvedValue({ id: 'newPlanId' });
            mockDb.collection.mockReturnValue({ doc: () => ({ collection: () => ({ add: addMock }) }) });
            
            const plan = [{ day: 'Day 1', exercises: [] }];
            await firestoreService.saveWorkoutPlan('user123', plan, 'dumbbells');

            expect(addMock).toHaveBeenCalledWith({
                plan,
                basedOnEquipment: 'dumbbells',
                createdAt: expect.any(String),
            });
        });
    });

    describe('exerciseExists', () => {
        it('should return true if an exercise exists', async () => {
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const getMock = jest.fn().mockResolvedValue({ empty: false });
            mockDb.collection.mockReturnValue({ where: () => ({ limit: () => ({ get: getMock }) }) });

            const exists = await firestoreService.exerciseExists('barbell squat');
            expect(exists).toBe(true);
        });

        it('should return false if an exercise does not exist', async () => {
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const getMock = jest.fn().mockResolvedValue({ empty: true });
            mockDb.collection.mockReturnValue({ where: () => ({ limit: () => ({ get: getMock }) }) });
            
            const exists = await firestoreService.exerciseExists('non-existent exercise');
            expect(exists).toBe(false);
        });
    });

    describe('saveCommunityExercise', () => {
        it('should save a new exercise with a normalized name', async () => {
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const setMock = jest.fn().mockResolvedValue(undefined);
            mockDb.collection.mockReturnValue({ doc: () => ({ set: setMock }) });
            
            const exercise = { id: 'test_id', name: 'Test Exercise' } as any;
            await firestoreService.saveCommunityExercise(exercise);
            
            expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
                name_normalized: 'test exercise'
            }));
        });
    });

    describe('getCommunityExercises', () => {
        it('should retrieve and map all community exercises', async () => {
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const getMock = jest.fn().mockResolvedValue({
                docs: [
                    { data: () => ({ name: 'Community Squat' }) },
                    { data: () => ({ name: 'Community Bench' }) },
                ]
            });
            mockDb.collection.mockReturnValue({ get: getMock });
            
            const exercises = await firestoreService.getCommunityExercises();
            expect(exercises).toHaveLength(2);
            expect(exercises[0].name).toBe('Community Squat');
        });
    });

    describe('createUserProfile', () => {
        it('should create a profile if one does not exist', async () => {
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const getMock = jest.fn().mockResolvedValue({ exists: false });
            const setMock = jest.fn().mockResolvedValue(undefined);
            mockDb.collection.mockReturnValue({ doc: () => ({ get: getMock, set: setMock }) });
            
            const user = { uid: 'newUser', email: 'new@user.com' } as firebase.User;
            await firestoreService.createUserProfile(user);
            
            expect(getMock).toHaveBeenCalled();
            expect(setMock).toHaveBeenCalled();
            expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
                displayName: 'new'
            }));
        });

        it('should not create a profile if one already exists', async () => {
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const getMock = jest.fn().mockResolvedValue({ exists: true });
            const setMock = jest.fn().mockResolvedValue(undefined);
            mockDb.collection.mockReturnValue({ doc: () => ({ get: getMock, set: setMock }) });
            
            const user = { uid: 'existingUser', email: 'existing@user.com' } as firebase.User;
            await firestoreService.createUserProfile(user);

            expect(getMock).toHaveBeenCalled();
            expect(setMock).not.toHaveBeenCalled();
        });
    });

    describe('getUserProfile', () => {
        it('should return a user profile if found', async () => {
            const profileData = { uid: 'user123', displayName: 'Test' };
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const getMock = jest.fn().mockResolvedValue({ exists: true, data: () => profileData });
            mockDb.collection.mockReturnValue({ doc: () => ({ get: getMock }) });
            
            const profile = await firestoreService.getUserProfile('user123');
            expect(profile).toEqual(profileData);
        });

        it('should return null if no user profile is found', async () => {
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const getMock = jest.fn().mockResolvedValue({ exists: false });
            mockDb.collection.mockReturnValue({ doc: () => ({ get: getMock }) });
            
            const profile = await firestoreService.getUserProfile('nonexistentUser');
            expect(profile).toBeNull();
        });
    });
    
    describe('awardPointsToUser', () => {
        it('should call update with FieldValue.increment', async () => {
            // Fix: Add <any, any> to jest.fn() to avoid 'never' type errors.
            const updateMock = jest.fn().mockResolvedValue(undefined);
            mockDb.collection.mockReturnValue({ doc: () => ({ update: updateMock }) });
            
            await firestoreService.awardPointsToUser('user123', 5);
            
            expect(updateMock).toHaveBeenCalledWith({
                points: mockFieldValue.increment(5)
            });
        });
    });
});

// Fix: mockImplementation for Date.now() must return a number.
// A small hack to replace the mocked Date.now in uploadImage with a static value for predictable paths
jest.spyOn(Date, 'now').mockImplementation(() => 1234567890);