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

const DocumentNameInfo: FC = () => {
    const name = useDocumentName();

    return <>{name}</>;
};

const SelectionInfo: FC = () => {
    const { length } = useSelectedShapesIds();

    return <>{`selection: [${length}]`}</>;
};

/** The status bar's slots, in order; each renders again only when what it shows changes. */
const SLOTS: { name: string; Content: FC }[] = [
    { name: 'message', Content: DocumentNameInfo },
    { name: 'save', Content: SaveStatusInfo },
    { name: 'account', Content: AccountInfo },
    { name: 'selection', Content: SelectionInfo },
    { name: 'keyboard', Content: KeyboardInfo },
    { name: 'mouse', Content: MouseInfo },
    { name: 'camera', Content: CameraInfo },
    { name: 'tools', Content: ZoomSlider }
];

export const StatusBarContainer: FC = () => {
    const { statusBar } = useControls();

    if (!statusBar.visible) {
        return null;
    }

    return (
        <StatusBar>
            {SLOTS.map(({ name, Content }) => (
                <StatusBarSlot key={name} name={name}>
                    <Content />
                </StatusBarSlot>
            ))}
        </StatusBar>
    );
};
