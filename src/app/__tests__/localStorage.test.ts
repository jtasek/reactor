import { backupState, loadState, saveState } from '../services/localStorage';

describe('local storage boundary', () => {
    const storage = new Map<string, string>();
    const getItem = vi.fn((key: string) => storage.get(key) ?? null);
    const setItem = vi.fn((key: string, value: string) => {
        storage.set(key, value);
    });

    beforeEach(() => {
        storage.clear();
        getItem.mockClear();
        setItem.mockClear();

        vi.stubGlobal('localStorage', {
            getItem,
            setItem,
            key: (index: number) => [...storage.keys()][index] ?? null,
            get length() {
                return storage.size;
            }
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('distinguishes a missing key from a stored null payload', () => {
        expect(loadState('reactor')).toBeUndefined();

        storage.set('reactor', 'null');

        expect(loadState('reactor')).toBeNull();
    });

    it('backs up the original bytes without overwriting previous backups', () => {
        const original = ' {invalid JSON';

        vi.spyOn(Date, 'now').mockReturnValue(100);
        storage.set('reactor', original);

        backupState('reactor');
        storage.set('reactor', 'different original');
        backupState('reactor');

        expect(storage.get('reactor')).toBe('different original');
        expect(storage.get('reactor:backup:100')).toBe(original);
        expect(storage.get('reactor:backup:100:1')).toBe('different original');
    });

    it('reuses identical backups across repeated loads instead of filling storage', () => {
        storage.set('reactor', 'original');
        storage.set('reactor:backup:old', 'original');

        backupState('reactor');

        expect(setItem).not.toHaveBeenCalled();
        expect(storage.size).toBe(2);
    });

    it('does not create a backup when storage is empty', () => {
        backupState('reactor');

        expect(setItem).not.toHaveBeenCalled();
    });

    it('reports malformed JSON instead of hiding it as empty storage', () => {
        storage.set('reactor', '{invalid');

        expect(() => loadState('reactor')).toThrow();
        expect(storage.get('reactor')).toBe('{invalid');
    });

    it('propagates storage access and quota failures', () => {
        getItem.mockImplementationOnce(() => {
            throw new Error('Storage unavailable');
        });

        expect(() => loadState('reactor')).toThrow('Storage unavailable');

        setItem.mockImplementationOnce(() => {
            throw new Error('Quota exceeded');
        });

        expect(() => saveState('reactor', {})).toThrow('Quota exceeded');
        expect(storage.has('reactor')).toBe(false);
    });
});
