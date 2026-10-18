import type { PackageIdentity } from './types';

/** Durable identity is independent of labels and local document IDs. */
export function readPackageIdentity(value: unknown): PackageIdentity {
    if (!value || typeof value !== 'object') throw new Error('Invalid package identity');
    const source = value as Record<string, unknown>;
    const text = (value: unknown) => {
        if (typeof value !== 'string' || !value.trim() || value.length > 200)
            throw new Error('Invalid package identity');
        return value;
    };
    return { packageId: text(source.packageId), tokenId: text(source.tokenId) };
}
