import { accounts } from 'src/app/services/accounts';

vi.mock('src/app/services/accountRequests', () => {
    throw new Error('Authentication chunk unavailable');
});

it('returns a recoverable result when the authentication request module cannot load', async () => {
    await expect(accounts.signOut()).resolves.toEqual({
        ok: false,
        message: 'The server could not be reached. Try again.'
    });
});
