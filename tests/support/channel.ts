import type { Channel } from 'src/app/services/tabSync';

/**
 * A BroadcastChannel for copies in one test: messages wait until `deliver`, and a
 * frozen copy misses the messages posted meanwhile.
 */
export class Hub {
    readonly frozen = new Set<Channel>();
    private readonly channels = new Set<Channel>();
    private readonly queue: Array<() => void> = [];

    open(): Channel {
        const channel: Channel = {
            onmessage: null,
            postMessage: (message) =>
                this.channels.forEach((other) => {
                    if (other !== channel && !this.frozen.has(other)) {
                        const data: unknown = structuredClone(message);

                        this.queue.push(() =>
                            other.onmessage?.(new MessageEvent('message', { data }))
                        );
                    }
                }),
            close: () => this.channels.delete(channel)
        };

        this.channels.add(channel);

        return channel;
    }

    /** Delivers messages, including the answers they bring, until none are left. */
    deliver() {
        while (this.queue.length > 0) {
            this.queue.shift()?.();
        }
    }
}
