import { commandAvailable, publishCommandAvailability } from 'src/app/commandAvailability';

describe('command availability', () => {
    it('answers false for a command nothing was published for', () => {
        expect(commandAvailable('never-registered')).toBe(false);
    });

    it('keeps the last published answer per command', () => {
        publishCommandAvailability({ delete: true, group: false });

        expect(commandAvailable('delete')).toBe(true);
        expect(commandAvailable('group')).toBe(false);

        publishCommandAvailability({ delete: false, group: false });

        expect(commandAvailable('delete')).toBe(false);
    });
});
