import { LayoutTemplate } from 'lucide-react';
import React, { FC } from 'react';

import {
    useAccount,
    useAppState,
    useCamera,
    useControls,
    useCurrentPage,
    useDebugMode,
    useDocumentName,
    useKeyboard,
    usePointerPosition
} from 'src/app/hooks';
import { accountLabel, loginFrom } from 'src/app/services/accounts';
import { useSelectionCount } from 'src/app/frameHooks';

import { Avatars } from '../Avatars';
import styles from './styles.css';

import { ZoomSlider } from './ZoomSlider';
import { StatusBarSlot } from './StatusBarSlot';
import { StatusBar } from './StatusBar';
import { SaveStatusInfo } from './SaveStatusInfo';

export { SaveStatusInfo } from './SaveStatusInfo';

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

/** Leads to the account page: to sign in, or showing who is signed in. */
export const AccountInfo: FC = () => {
    const account = useAccount();
    const page = useCurrentPage();

    if (account.kind === 'loading' || account.kind === 'unavailable') {
        return null;
    }

    return (
        <a
            className={styles.accountLink}
            href={account.kind === 'signedIn' ? '/account' : loginFrom(page)}
            title={account.kind === 'signedIn' ? account.email : undefined}
        >
            {account.kind === 'signedIn' && (
                <Avatars
                    people={[{ name: accountLabel(account), image: account.image }]}
                    decorative
                />
            )}
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
    const template = useAppState((state) => state.currentDocument.template);

    return (
        <>
            {name}
            {template && (
                <span className={styles.template}>
                    <LayoutTemplate size={12} strokeWidth={1.75} aria-hidden="true" />
                    Template
                </span>
            )}
        </>
    );
};

const SelectionInfo: FC = () => {
    const length = useSelectionCount();

    return <>{`selection: [${length}]`}</>;
};

/**
 * The status bar's slots, in order; each renders again only when what it shows changes.
 * The readouts show only in debug mode.
 */
const SLOTS: { name: string; Content: FC; debug?: boolean }[] = [
    { name: 'message', Content: DocumentNameInfo },
    { name: 'save', Content: SaveStatusInfo },
    { name: 'account', Content: AccountInfo },
    { name: 'selection', Content: SelectionInfo, debug: true },
    { name: 'keyboard', Content: KeyboardInfo, debug: true },
    { name: 'mouse', Content: MouseInfo, debug: true },
    { name: 'camera', Content: CameraInfo, debug: true },
    { name: 'tools', Content: ZoomSlider }
];

export const StatusBarContainer: FC = () => {
    const { statusBar } = useControls();
    const debugMode = useDebugMode();

    if (!statusBar.visible) {
        return null;
    }

    return (
        <StatusBar>
            {SLOTS.filter(({ debug }) => debugMode || !debug).map(({ name, Content }) => (
                <StatusBarSlot key={name} name={name}>
                    <Content />
                </StatusBarSlot>
            ))}
        </StatusBar>
    );
};
