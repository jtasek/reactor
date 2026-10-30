import React from 'react';
import { useSaveStatus } from 'src/app/hooks';

const SAVE_LABELS = {
    saved: 'Saved',
    saving: 'Saving…',
    syncing: 'Syncing…',
    offline: 'Offline',
    notSaving: 'Not saving'
};

const OFFLINE =
    'The server cannot be reached. Changes are kept in this browser and sync once it can.';

export function SaveStatusInfo() {
    const status = useSaveStatus();

    return (
        <span
            title={
                status.kind === 'notSaving'
                    ? status.reason
                    : status.kind === 'offline'
                      ? OFFLINE
                      : undefined
            }
        >
            {SAVE_LABELS[status.kind]}
        </span>
    );
}
