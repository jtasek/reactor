import React, { FC } from 'react';

import {
    useAccount,
    useCamera,
    useControls,
    useCurrentDocument,
    useKeyboard,
    usePointer,
    useSaveStatus
} from 'src/app/hooks';
import { accountLabel } from 'src/app/services/accounts';

import { ZoomSlider } from './ZoomSlider';
import { StatusBarSlot } from './StatusBarSlot';
import { StatusBar } from './StatusBar';

export const KeyboardInfo: FC = () => {
    const keyboard = useKeyboard();

    const result: string[] = [];
    result.push('keyboard: [');

    if (keyboard.altKey) {
        result.push('ALT +');
    }
    if (keyboard.ctrlKey) {
        result.push('CTRL + ');
    }
    if (keyboard.shiftKey) {
        result.push('SHIFT + ');
    }

    result.push(keyboard.key);
    result.push(']');

    return <span>{result.join(' ')}</span>;
};

const SAVE_LABELS = {
    saved: 'Saved',
    saving: 'Saving…',
    syncing: 'Syncing…',
    offline: 'Offline',
    notSaving: 'Not saving'
};

const OFFLINE =
    'The server cannot be reached. Changes are kept in this browser and sync once it can.';

export const SaveStatusInfo: FC = () => {
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
};

/** Leads to the account page: to sign in, or showing who is signed in. */
export const AccountInfo: FC = () => {
    const account = useAccount();

    if (account.kind === 'loading' || account.kind === 'unavailable') {
        return null;
    }

    return (
        <a href="/account" title={account.kind === 'signedIn' ? account.email : undefined}>
            {account.kind === 'signedIn' ? accountLabel(account) : 'Sign in'}
        </a>
    );
};

export const StatusBarContainer: FC = () => {
    const { position: offset, scale } = useCamera();
    const { name, selectedShapesIds } = useCurrentDocument();
    const { statusBar } = useControls();
    const { current } = usePointer();

    if (!statusBar.visible) {
        return null;
    }

    const selectedShapeCount = selectedShapesIds?.length;

    return (
        <StatusBar>
            <StatusBarSlot name="message">{name}</StatusBarSlot>
            <StatusBarSlot name="save">
                <SaveStatusInfo />
            </StatusBarSlot>
            <StatusBarSlot name="account">
                <AccountInfo />
            </StatusBarSlot>
            <StatusBarSlot name="selection">{`selection: [${selectedShapeCount}]`}</StatusBarSlot>
            <StatusBarSlot name="keyboard">
                <KeyboardInfo />
            </StatusBarSlot>
            <StatusBarSlot name="mouse">{`mouse: [${Math.round(current.x)}, ${Math.round(current.y)}]`}</StatusBarSlot>
            <StatusBarSlot name="camera">{`camera: [${Math.round(offset.x)}, ${Math.round(offset.y)}, ${scale}]`}</StatusBarSlot>
            <StatusBarSlot name="tools">
                <ZoomSlider />
            </StatusBarSlot>
        </StatusBar>
    );
};
