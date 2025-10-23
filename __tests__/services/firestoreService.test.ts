// __tests__/services/firestoreService.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { db, storage } from '../../firebase';
import * as firestoreService from '../../services/firestoreService';
import firebase from 'firebase/compat/app';

// Mock the entire firebase dependency
jest.mock('../../firebase', () => {
    // Re-mocking the chained API
    const collection = jest.fn();
    const doc = jest.fn();
    const where = jest.fn();
    const orderBy = jest.fn();
    const limit = jest.fn();
    const get = jest.fn();
    const set = jest.fn();
    const add = jest.fn();
    const update = jest.fn();

    // The query object that gets returned by query methods
    const query = { where, orderBy, limit, get };
    
    collection.mockReturnValue({ doc, where, orderBy, get, add });
    doc.mockReturnValue({ set, get, update, collection });
    where.mockReturnValue(query);
    orderBy.mockReturnValue(query);
    limit.mockReturnValue(query);

    return {
        db: {
            collection,
        },
        storage: {
            ref: jest.fn(() => ({
                put: jest.fn(() => Promise.resolve({
                    ref: {
                        getDownloadURL: jest.fn(() => Promise.resolve('http://mock-url.com/image.jpg'))
                    }
                }))
            })),
        },
    };
});

// Mock the firebase/compat/app dependency which is used for types and FieldValue
jest.mock('firebase/compat/app', () => {
    return {
        firestore: {
            FieldValue: {
                serverTimestamp: jest.fn(() => 'mock_timestamp'),
                increment: jest.fn(val => `increment(${val})`),
            },
            Timestamp: {
                fromDate: (date: Date) => ({ toDate: () => date, _isMock: true }),
            },
        }
    }
}, { virtual: true }); // Use virtual mock


const mockCollection = db.collection as jest.Mock;
const mockStorageRef = storage.ref as jest.Mock;

describe('firestoreService', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
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
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const addMock = jest.fn().mockResolvedValue({ id: 'newLogId' } as any);
            // Fix: Cast chained properties to 'any' to avoid 'does not exist on type unknown' error.
            ((mockCollection('users') as any).doc('user123').collection as jest.Mock).mockReturnValue({ add: addMock });
            
            const mealData = { imageUrl: 'url', foodItems: ['apple'], nutrition: {} as any };
            await firestoreService.saveMealLog('user123', mealData);
            
            expect(addMock).toHaveBeenCalledWith(expect.objectContaining({
                ...mealData,
                createdAt: 'mock_timestamp',
            }));
        });
    });

    describe('getTodaysMealLogs', () => {
        it('should query for meal logs within the correct date range', async () => {
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const getMock = jest.fn().mockResolvedValue({
                docs: [{ id: 'log1', data: () => ({ foodItems: ['banana'] }) }],
            } as any);
            const orderByMock = jest.fn().mockReturnValue({ get: getMock });
            const whereMock = jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ orderBy: orderByMock }) });
            // Fix: Cast chained properties to 'any' to avoid 'does not exist on type unknown' error.
            ((mockCollection('users') as any).doc('user123').collection as jest.Mock).mockReturnValue({ where: whereMock });
            
            const logs = await firestoreService.getTodaysMealLogs('user123');
            
            expect(whereMock.mock.calls[0][0]).toBe('createdAt');
            expect(whereMock.mock.calls[0][1]).toBe('>=');
            expect(whereMock.mock.calls[1][0]).toBe('createdAt');
            expect(whereMock.mock.calls[1][1]).toBe('<');
            expect(orderByMock).toHaveBeenCalledWith('createdAt', 'desc');
            expect(logs).toHaveLength(1);
            expect(logs[0].id).toBe('log1');
        });
    });
    
    describe('saveWorkoutPlan', () => {
        it('should save workout plan data to the correct user subcollection', async () => {
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const addMock = jest.fn().mockResolvedValue({ id: 'newPlanId' } as any);
            // Fix: Cast chained properties to 'any' to avoid 'does not exist on type unknown' error.
            ((mockCollection('users') as any).doc('user123').collection as jest.Mock).mockReturnValue({ add: addMock });
            
            const plan = [{ day: 'Day 1', exercises: [] }];
            await firestoreService.saveWorkoutPlan('user123', plan, 'dumbbells');

            expect(addMock).toHaveBeenCalledWith({
                plan,
                basedOnEquipment: 'dumbbells',
                createdAt: 'mock_timestamp',
            });
        });
    });

    describe('exerciseExists', () => {
        it('should return true if an exercise exists', async () => {
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const getMock = jest.fn().mockResolvedValue({ empty: false } as any);
            const limitMock = jest.fn().mockReturnValue({ get: getMock });
            const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
            mockCollection.mockReturnValue({ where: whereMock });

            const exists = await firestoreService.exerciseExists('barbell squat');
            expect(whereMock).toHaveBeenCalledWith("name_normalized", "==", "barbell squat");
            expect(exists).toBe(true);
        });

        it('should return false if an exercise does not exist', async () => {
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const getMock = jest.fn().mockResolvedValue({ empty: true } as any);
            const limitMock = jest.fn().mockReturnValue({ get: getMock });
            const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
            mockCollection.mockReturnValue({ where: whereMock });

            const exists = await firestoreService.exerciseExists('non-existent');
            expect(exists).toBe(false);
        });
    });

    describe('saveCommunityExercise', () => {
        it('should save a new exercise with a normalized name', async () => {
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const setMock = jest.fn().mockResolvedValue(undefined as any);
            const docMock = jest.fn().mockReturnValue({ set: setMock });
            mockCollection.mockReturnValue({ doc: docMock });
            
            const exercise = { id: 'test_id', name: 'Test Exercise' } as any;
            await firestoreService.saveCommunityExercise(exercise);
            
            expect(docMock).toHaveBeenCalledWith('test_id');
            expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
                name_normalized: 'test exercise'
            }));
        });
    });

    describe('getCommunityExercises', () => {
        it('should retrieve and map all community exercises', async () => {
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const getMock = jest.fn().mockResolvedValue({
                docs: [
                    { data: () => ({ name: 'Community Squat' }) },
                    { data: () => ({ name: 'Community Bench' }) },
                ]
            } as any);
            mockCollection.mockReturnValue({ get: getMock });

            const exercises = await firestoreService.getCommunityExercises();
            expect(exercises).toHaveLength(2);
            expect(exercises[0].name).toBe('Community Squat');
        });
    });

    describe('createUserProfile', () => {
        it('should create a profile if one does not exist', async () => {
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const setMock = jest.fn().mockResolvedValue(undefined as any);
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const getMock = jest.fn().mockResolvedValue({ exists: false } as any);
            const docMock = jest.fn().mockReturnValue({ get: getMock, set: setMock });
            mockCollection.mockReturnValue({ doc: docMock });

            const user = { uid: 'newUser', email: 'new@user.com' } as firebase.User;
            await firestoreService.createUserProfile(user);

            expect(getMock).toHaveBeenCalled();
            expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
                displayName: 'new'
            }));
        });

        it('should not create a profile if one already exists', async () => {
            const setMock = jest.fn();
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const getMock = jest.fn().mockResolvedValue({ exists: true } as any);
            const docMock = jest.fn().mockReturnValue({ get: getMock, set: setMock });
            mockCollection.mockReturnValue({ doc: docMock });
            
            const user = { uid: 'existingUser', email: 'existing@user.com' } as firebase.User;
            await firestoreService.createUserProfile(user);
            
            expect(getMock).toHaveBeenCalled();
            expect(setMock).not.toHaveBeenCalled();
        });
    });

    describe('getUserProfile', () => {
        it('should return a user profile if found', async () => {
            const profileData = { uid: 'user123', displayName: 'Test' };
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const getMock = jest.fn().mockResolvedValue({ exists: true, data: () => profileData } as any);
            const docMock = jest.fn().mockReturnValue({ get: getMock });
            mockCollection.mockReturnValue({ doc: docMock });
            
            const profile = await firestoreService.getUserProfile('user123');
            expect(profile).toEqual(profileData);
        });

        it('should return null if no user profile is found', async () => {
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const getMock = jest.fn().mockResolvedValue({ exists: false } as any);
            const docMock = jest.fn().mockReturnValue({ get: getMock });
            mockCollection.mockReturnValue({ doc: docMock });
            
            const profile = await firestoreService.getUserProfile('nonexistentUser');
            expect(profile).toBeNull();
        });
    });
    
    describe('awardPointsToUser', () => {
        it('should call update with FieldValue.increment', async () => {
            // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
            const updateMock = jest.fn().mockResolvedValue(undefined as any);
            const docMock = jest.fn().mockReturnValue({ update: updateMock });
            mockCollection.mockReturnValue({ doc: docMock });
            
            await firestoreService.awardPointsToUser('user123', 5);
            
            expect(updateMock).toHaveBeenCalledWith({
                points: firebase.firestore.FieldValue.increment(5)
            });
        });
    });
});
