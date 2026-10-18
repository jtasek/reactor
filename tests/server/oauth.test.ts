import { generateKeyPairSync, sign } from 'node:crypto';
import { socialProvidersFromEnv } from '../../server/oauth';
import { ORIGIN, cookieHeader, findLink, serve, startAccounts } from './support';

const configured = socialProvidersFromEnv({
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GITHUB_CLIENT_ID: 'github-client',
    GITHUB_CLIENT_SECRET: 'github-secret'
});

afterEach(() => vi.unstubAllGlobals());

it('leaves providers off without credentials and rejects incomplete credentials', () => {
    expect(socialProvidersFromEnv({})).toEqual({});
    expect(() => socialProvidersFromEnv({ GOOGLE_CLIENT_ID: 'id' })).toThrow('required together');
    expect(() => socialProvidersFromEnv({ GITHUB_CLIENT_SECRET: 'secret' })).toThrow(
        'required together'
    );
});

type Provider = 'google' | 'github';

let clients = 0;
/** A client address of each test's own, as Better Auth limits requests per client. */
const clientAddress = () => {
    clients += 1;

    return { 'x-reactor-client-address': `198.18.10.${clients}` };
};

/** A provider that answers with `profile`, changed between sign-ins as the person changes it. */
function mockProvider(
    provider: Provider,
    request: Awaited<ReturnType<typeof startAccounts>>['request'],
    headers = clientAddress()
) {
    const profile = {
        name: 'Ada',
        email: 'ada@example.com',
        image: 'https://photos.example/first.png'
    };
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = {
        ...publicKey.export({ format: 'jwk' }),
        kid: 'test',
        alg: 'RS256',
        use: 'sig'
    };
    const idToken = () => {
        const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
        const now = Math.floor(Date.now() / 1000);
        const data = `${encode({ alg: 'RS256', kid: 'test' })}.${encode({
            sub: 'google-ada',
            iss: 'https://accounts.google.com',
            aud: 'google-client',
            iat: now,
            exp: now + 3600,
            email: profile.email,
            email_verified: true,
            name: profile.name,
            picture: profile.image
        })}`;
        return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
    };
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL | Request) => {
            const url = String(input instanceof Request ? input.url : input);
            if (url === 'https://www.googleapis.com/oauth2/v3/certs')
                return Response.json({ keys: [jwk] });
            if (url === 'https://oauth2.googleapis.com/token')
                return Response.json({
                    access_token: 'test',
                    token_type: 'Bearer',
                    id_token: idToken()
                });
            if (url === 'https://github.com/login/oauth/access_token')
                return Response.json({
                    access_token: 'test',
                    token_type: 'Bearer',
                    scope: 'read:user,user:email'
                });
            // As for people who keep their email private, it comes from the emails list.
            if (url === 'https://api.github.com/user')
                return Response.json({
                    id: 123,
                    login: 'ada',
                    name: profile.name,
                    email: null,
                    avatar_url: profile.image
                });
            if (url === 'https://api.github.com/user/emails')
                return Response.json([{ email: profile.email, primary: true, verified: true }]);
            throw new Error(`Unexpected fetch: ${url}`);
        })
    );
    /** Signs in with the provider and answers where its callback leads, with the cookies set. */
    const callback = async () => {
        const begin = await request('/api/auth/sign-in/social', {
            headers,
            body: {
                provider,
                callbackURL: '/account',
                errorCallbackURL: '/account?oauth=failed',
                disableRedirect: true
            }
        });
        expect(begin.ok, await begin.clone().text()).toBe(true);
        const authorization = new URL((await begin.json()).url);
        expect(authorization.searchParams.get('redirect_uri')).toBe(
            `${ORIGIN}/api/auth/callback/${provider}`
        );
        const state = authorization.searchParams.get('state');
        return request(`/api/auth/callback/${provider}?code=test&state=${state}`, {
            cookie: cookieHeader(begin)
        });
    };
    const login = async () => {
        const response = await callback();
        expect(response.headers.get('location')).toBe('/account');
        const session = await request('/api/auth/get-session', {
            cookie: cookieHeader(response)
        });
        return (await session.json()).user;
    };

    return { profile, callback, login };
}

for (const provider of ['google', 'github'] as const) {
    it(`${provider} refreshes only the profile photo on a later sign-in`, async () => {
        const { db, request } = await startAccounts([], configured);
        onTestFinished(() => db.destroy());
        const { profile, login } = mockProvider(provider, request);

        const first = await login();
        expect(first).toMatchObject({
            name: 'Ada',
            email: 'ada@example.com',
            image: profile.image,
            emailVerified: true
        });

        profile.name = 'Ada Lovelace';
        profile.email = 'lovelace@example.com';
        profile.image = 'https://photos.example/updated.png';
        const second = await login();
        expect(second).toMatchObject({
            id: first.id,
            name: 'Ada',
            email: 'ada@example.com',
            image: profile.image,
            emailVerified: true
        });
    });

    it(`${provider} keeps the name of a confirmed email account it links to`, async () => {
        const { db, request, outbox } = await startAccounts([], configured);
        onTestFinished(() => db.destroy());
        const account = {
            name: 'Countess',
            email: 'ada@example.com',
            password: 'correct horse battery'
        };
        const headers = clientAddress();
        expect((await request('/api/auth/sign-up/email', { body: account, headers })).ok).toBe(
            true
        );
        await request(findLink(outbox[0]));
        const { profile, login } = mockProvider(provider, request, headers);

        expect(await login()).toMatchObject({
            name: 'Countess',
            email: 'ada@example.com',
            image: profile.image
        });
    });

    it(`${provider} says when an unconfirmed email account stops it linking`, async () => {
        const { db, request } = await startAccounts([], configured);
        onTestFinished(() => db.destroy());
        const account = {
            name: 'Ada',
            email: 'ada@example.com',
            password: 'correct horse battery'
        };
        const headers = clientAddress();
        expect((await request('/api/auth/sign-up/email', { body: account, headers })).ok).toBe(
            true
        );
        const { callback } = mockProvider(provider, request, headers);

        const location = new URL((await callback()).headers.get('location') ?? '', ORIGIN);
        expect(location.pathname).toBe('/account');
        expect(location.searchParams.get('oauth')).toBe('failed');
        expect(location.searchParams.get('error')).toBe('account_not_linked');
    });
}

it('publishes only configured provider names to signed-out clients', async () => {
    const { call } = await serve({ socialProviders: configured });
    const response = await call('GET', '/sign-in/providers');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(['google', 'github']);
});
