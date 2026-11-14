import React, { FC, memo, useSyncExternalStore } from 'react';
import { useAppState } from 'src/app/hooks';
import { drawnBox } from 'src/app/membership';
import { renderedShape } from 'src/app/frameLayout';
import { presence, type Peer } from 'src/app/services/presence';
import type { Box, Document } from 'src/app/types';

/** Sizes on screen, in pixels, whatever the zoom. */
const POINTER_PATH = 'M0 0L0 16L4.5 12L7.5 19L10.5 17.7L7.5 11L13 11Z';
const LABEL_X = 12;
const LABEL_Y = 20;
const LABEL_HEIGHT = 18;
const LABEL_PADDING = 6;
/** About how wide a character of the label is, as SVG text cannot be measured before drawing. */
const LABEL_CHARACTER = 6.6;
const SELECTION_OUTSET = 3;

/** The boxes of the shapes `peer` selected that this copy still has, as drawn. */
function selectedBoxes(document: Document, peer: Peer): Box[] {
    return peer.selection
        .filter((id) => Object.hasOwn(document.shapes, id))
        .map((id) => drawnBox(renderedShape(document, id)));
}

const PeerSelection: FC<{ peer: Peer; document: Document; scale: number }> = ({
    peer,
    document,
    scale
}) => {
    const outset = SELECTION_OUTSET / scale;

    return (
        <g data-presence-selection={peer.name} stroke={peer.color}>
            {selectedBoxes(document, peer).map(({ topLeft, width, height }, index) => (
                <rect
                    key={index}
                    fill="none"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    x={topLeft.x - outset}
                    y={topLeft.y - outset}
                    width={width + outset * 2}
                    height={height + outset * 2}
                />
            ))}
        </g>
    );
};

const PeerPointer: FC<{ peer: Peer; scale: number }> = memo(function PeerPointer({ peer, scale }) {
    if (!peer.pointer) {
        return null;
    }

    const width = peer.name.length * LABEL_CHARACTER + LABEL_PADDING * 2;

    return (
        <g
            data-presence-pointer={peer.name}
            style={{
                transform: `translate(${peer.pointer.x}px, ${peer.pointer.y}px) scale(${1 / scale})`
            }}
        >
            <path d={POINTER_PATH} fill={peer.color} stroke="#fff" />
            <rect
                x={LABEL_X}
                y={LABEL_Y - LABEL_HEIGHT / 2}
                width={width}
                height={LABEL_HEIGHT}
                rx={LABEL_HEIGHT / 2}
                fill={peer.color}
            />
            <text
                x={LABEL_X + LABEL_PADDING}
                y={LABEL_Y}
                fill="#fff"
                fontSize={12}
                fontWeight={600}
                dominantBaseline="middle"
            >
                {peer.name}
            </text>
        </g>
    );
});

const usePeers = (documentId: string) =>
    useSyncExternalStore(presence.subscribe, () => presence.peers(documentId));

/**
 * Where the other people with this document open have their pointers, named and
 * in their color, and which shapes they have selected. Drawn in canvas
 * coordinates, inside the camera, at a constant size on screen; it takes no input.
 */
export const Presence: FC = () => {
    const document = useAppState((state) => state.currentDocument);
    const scale = useAppState((state) => state.currentDocument.camera.scale);
    const peers = usePeers(document.id);

    if (peers.length === 0) {
        return null;
    }

    return (
        <g pointerEvents="none" aria-hidden="true" data-presence="">
            {peers.map((peer) => (
                <PeerSelection key={peer.clientId} peer={peer} document={document} scale={scale} />
            ))}
            {peers.map((peer) => (
                <PeerPointer key={peer.clientId} peer={peer} scale={scale} />
            ))}
        </g>
    );
};
