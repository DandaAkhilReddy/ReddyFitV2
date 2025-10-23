// __tests__/database/dbService.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { initDB, get, set, clearAllData } from '../../database/dbService';
import 'fake-indexeddb/auto';

describe('dbService (IndexedDB)', () => {

    // Before each test, we want to ensure the DB is in a clean state.
    // fake-indexeddb handles this pretty well, but we can be explicit.
    beforeEach(async () => {
        // This effectively resets the database for each test by closing the old connection
        // and letting initDB open a fresh one.
        const dbs = await indexedDB.databases();
        for (const dbInfo of dbs) {
            if (dbInfo.name) {
                 indexedDB.deleteDatabase(dbInfo.name);
            }
        }
    });

    it('should initialize the database with the correct object stores', async () => {
        await initDB();
        
        // A bit of an internal check, but it verifies setup.
        // We'll open a connection to check the stores.
        const request = indexedDB.open('ReddyFitDB');
        
        return new Promise<void>(resolve => {
            request.onsuccess = () => {
                const db = request.result;
                expect(db.objectStoreNames.contains('workoutPlans')).toBe(true);
                db.close();
                resolve();
            };
        });
    });

    it('should set and get a value from an object store', async () => {
        const key = 'test-key';
        const value = { data: 'test-data' };

        await set('workoutPlans', key, value);
        const retrievedValue = await get('workoutPlans', key);

        expect(retrievedValue).toEqual(value);
    });

    it('should overwrite a value when setting with the same key', async () => {
        const key = 'overwrite-key';
        const value1 = { data: 'initial' };
        const value2 = { data: 'updated' };

        await set('workoutPlans', key, value1);
        const retrieved1 = await get('workoutPlans', key);
        expect(retrieved1).toEqual(value1);
        
        await set('workoutPlans', key, value2);
        const retrieved2 = await get('workoutPlans', key);
        expect(retrieved2).toEqual(value2);
    });

    it('should return undefined when getting a non-existent key', async () => {
        const retrievedValue = await get('workoutPlans', 'non-existent-key');
        expect(retrievedValue).toBeUndefined();
    });

    it('should clear all data from the database', async () => {
        const key1 = 'key1';
        const value1 = 'data1';
        const key2 = 'key2';
        const value2 = 'data2';
        
        await set('workoutPlans', key1, value1);
        await set('workoutPlans', key2, value2);
        
        // Verify data exists
        expect(await get('workoutPlans', key1)).toBe(value1);
        
        // Clear data
        await clearAllData();
        
        // Verify data is gone
        expect(await get('workoutPlans', key1)).toBeUndefined();
        expect(await get('workoutPlans', key2)).toBeUndefined();
    });
});
