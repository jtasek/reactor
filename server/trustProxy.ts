import express from 'express';

/**
 * Express's `trust proxy` setting from `TRUST_PROXY`: unset or `false` trusts no
 * proxy, `true` every one, a whole number that many hops in front of the server,
 * and anything else a comma-separated list of addresses, subnets or the names
 * `loopback`, `linklocal` and `uniquelocal`. Throws on a value Express cannot read.
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string {
    const setting = value?.trim() ?? '';

    if (setting === '' || setting === 'false') {
        return false;
    }

    if (setting === 'true') {
        return true;
    }

    // Express reads a number as hops, but the same digits as a string as an address.
    if (/^\d+$/.test(setting)) {
        return Number(setting);
    }

    try {
        express().set('trust proxy', setting);
    } catch {
        throw new Error(
            `Invalid TRUST_PROXY: ${value}. Use a hop count, true, or addresses and subnets.`
        );
    }

    return setting;
}
