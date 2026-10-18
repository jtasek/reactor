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

export type SocialProviders = ReturnType<typeof socialProvidersFromEnv>;

/** What a sign-in keeps of the account it signs in to. */
export interface KnownUser {
    name: string;
    email: string;
    emailVerified: boolean;
}

/** Finds the account a provider's profile signs in to. */
export interface AccountLookup {
    /** The user a provider's account is linked to, if it is. */
    byAccount(providerId: string, accountId: string): Promise<KnownUser | undefined>;
    byEmail(email: string): Promise<KnownUser | undefined>;
}

/**
 * Social sign-in refreshes only the photo. Better Auth's `overrideUserInfoOnSignIn`
 * writes the provider's name and email too, so the profile is mapped back to the
 * account's own: a linked account keeps its name, email and whether that is
 * confirmed, and an account a provider first links to by email keeps its name.
 */
export function refreshingPhotoOnly(providers: SocialProviders, lookup: AccountLookup) {
    const keep = async (
        providerId: string,
        accountId: string,
        email: string | null
    ): Promise<Partial<KnownUser>> => {
        const linked = await lookup.byAccount(providerId, accountId);

        if (linked) {
            return { name: linked.name, email: linked.email, emailVerified: linked.emailVerified };
        }

        const byEmail = email ? await lookup.byEmail(email) : undefined;

        return byEmail ? { name: byEmail.name } : {};
    };
    const { google, github } = providers;

    return {
        ...(google && {
            google: {
                ...google,
                mapProfileToUser: (profile: { sub: string; email: string | null }) =>
                    keep('google', profile.sub, profile.email)
            }
        }),
        ...(github && {
            github: {
                ...github,
                mapProfileToUser: (profile: { id: string | number; email: string | null }) =>
                    keep('github', String(profile.id), profile.email)
            }
        })
    };
}
