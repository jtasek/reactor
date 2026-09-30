import express from 'express';
import type { AddressInfo } from 'net';
import { parseTrustProxy } from '../../server/trustProxy';

/** The client address the server sees for a request forwarded for `client`, with `TRUST_PROXY` set to `setting`. */
async function clientAddress(setting: string | undefined, client = '203.0.113.7') {
    const app = express();

    app.set('trust proxy', parseTrustProxy(setting));
    app.get('/', (req, res) => {
        res.send(req.ip);
    });

    const server = app.listen(0, '127.0.0.1');

    await new Promise((resolve) => server.once('listening', resolve));
    onTestFinished(() => {
        server.close();
    });

    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { 'x-forwarded-for': client }
    });

    return response.text();
}

describe('TRUST_PROXY', () => {
    it('reads hop counts as numbers, and true, false and address lists as Express does', () => {
        expect(parseTrustProxy(undefined)).toBe(false);
        expect(parseTrustProxy('')).toBe(false);
        expect(parseTrustProxy('false')).toBe(false);
        expect(parseTrustProxy('true')).toBe(true);
        expect(parseTrustProxy(' 1 ')).toBe(1);
        expect(parseTrustProxy('2')).toBe(2);
        expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
    });

    it('refuses what Express cannot read, instead of failing later', () => {
        expect(() => parseTrustProxy('yes')).toThrow('Invalid TRUST_PROXY: yes');
        expect(() => parseTrustProxy('-1')).toThrow('Invalid TRUST_PROXY');
    });

    it('takes the client address from one proxy in front, and only from a trusted one', async () => {
        expect(await clientAddress('1')).toBe('203.0.113.7');
        expect(await clientAddress('loopback')).toBe('203.0.113.7');
        expect(await clientAddress(undefined)).toBe('127.0.0.1');
        expect(await clientAddress('0')).toBe('127.0.0.1');
        expect(await clientAddress('10.0.0.0/8')).toBe('127.0.0.1');
    });
});
