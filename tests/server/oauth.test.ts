import { generateKeyPairSync, sign } from 'node:crypto';
import { socialProvidersFromEnv } from '../../server/oauth';
import { ORIGIN, cookieHeader, serve, startAccounts } from './support';

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

for (const provider of ['google', 'github'] as const) {
    it(`${provider} saves the profile photo and refreshes it on a later sign-in`, async () => {
        const { db, request } = await startAccounts([], configured);
        onTestFinished(() => db.destroy());
        let image = 'https://photos.example/first.png';
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const jwk = {
            ...publicKey.export({ format: 'jwk' }),
            kid: 'test',
            alg: 'RS256',
            use: 'sig'
        };
        const idToken = () => {
            const encode = (value: object) =>
                Buffer.from(JSON.stringify(value)).toString('base64url');
            const now = Math.floor(Date.now() / 1000);
            const data = `${encode({ alg: 'RS256', kid: 'test' })}.${encode({
                sub: 'google-ada',
                iss: 'https://accounts.google.com',
                aud: 'google-client',
                iat: now,
                exp: now + 3600,
                email: 'ada@example.com',
                email_verified: true,
                name: 'Ada',
                picture: image
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
                if (url === 'https://api.github.com/user')
                    return Response.json({
                        id: 123,
                        login: 'ada',
                        name: 'Ada',
                        email: 'ada@example.com',
                        avatar_url: image
                    });
                if (url === 'https://api.github.com/user/emails')
                    return Response.json([
                        { email: 'ada@example.com', primary: true, verified: true }
                    ]);
                throw new Error(`Unexpected fetch: ${url}`);
            })
        );
        const login = async () => {
            const begin = await request('/api/auth/sign-in/social', {
                headers: {
                    'x-reactor-client-address':
                        provider === 'google' ? '198.18.10.1' : '198.18.10.2'
                },
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
            const callback = await request(
                `/api/auth/callback/${provider}?code=test&state=${state}`,
                { cookie: cookieHeader(begin) }
            );
            expect(callback.headers.get('location')).toBe('/account');
            const session = await request('/api/auth/get-session', {
                cookie: cookieHeader(callback)
            });
            return (await session.json()).user;
        };
        const first = await login();
        expect(first.image).toBe(image);
        image = 'https://photos.example/updated.png';
        const second = await login();
        expect(second.id).toBe(first.id);
        expect(second.image).toBe(image);
    });
}

it('publishes only configured provider names to signed-out clients', async () => {
    const { call } = await serve({ socialProviders: configured });
    const response = await call('GET', '/sign-in/providers');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(['google', 'github']);
});
