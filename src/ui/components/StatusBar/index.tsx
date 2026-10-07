import React, { FC } from 'react';

import {
    useAccount,
    useCamera,
    useControls,
    useDocumentName,
    useKeyboard,
    usePointerPosition,
    useSaveStatus,
    useSelectedShapesIds
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

const MouseInfo: FC = () => {
    const { x, y } = usePointerPosition();

    return <>{`mouse: [${Math.round(x)}, ${Math.round(y)}]`}</>;
};

const CameraInfo: FC = () => {
    const { position, scale } = useCamera();

    return <>{`camera: [${Math.round(position.x)}, ${Math.round(position.y)}, ${scale}]`}</>;
};

export const StatusBarContainer: FC = () => {
    const name = useDocumentName();
    const selectedShapesIds = useSelectedShapesIds();
    const { statusBar } = useControls();

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
            <StatusBarSlot name="mouse">
                <MouseInfo />
            </StatusBarSlot>
            <StatusBarSlot name="camera">
                <CameraInfo />
            </StatusBarSlot>
            <StatusBarSlot name="tools">
                <ZoomSlider />
            </StatusBarSlot>
        </StatusBar>
    );
};
