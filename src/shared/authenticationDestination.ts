/** Pages authentication may return to; login itself is excluded to prevent loops. */
export const AUTH_DESTINATIONS: readonly string[] = ['/', '/documents', '/account', '/sharing'];

/** Recovery may also continue an invitation, whose secret stays in its original tab. */
export function recoveryDestination(value: string | null) {
    if (value === '/invite' || (value && AUTH_DESTINATIONS.includes(value))) {
        return value;
    }

    return '/documents';
}
