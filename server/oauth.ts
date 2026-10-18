/** Optional OAuth providers; credentials never leave the server. */
export function socialProvidersFromEnv(env: NodeJS.ProcessEnv) {
    const credentials = (provider: 'GOOGLE' | 'GITHUB') => {
        const clientId = env[`${provider}_CLIENT_ID`];
        const clientSecret = env[`${provider}_CLIENT_SECRET`];

        if (!clientId && !clientSecret) {
            return undefined;
        }
        if (!clientId || !clientSecret) {
            throw new Error(
                `${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET are required together`
            );
        }

        return { clientId, clientSecret, overrideUserInfoOnSignIn: true };
    };
    const google = credentials('GOOGLE');
    const github = credentials('GITHUB');

    return { ...(google && { google }), ...(github && { github }) };
}
