import type { AiCase } from '../../harness';
import { groupNamed } from '../../checks';

export default {
    fixture: {
        shapes: {
            avatar: { type: 'circle', position: { x: 60, y: 60 }, radius: 20 },
            fullName: { type: 'text', position: { x: 90, y: 50 }, value: 'Ada Lovelace' },
            footer: {
                type: 'rectangle',
                position: { x: 0, y: 400 },
                size: { width: 300, height: 40 }
            }
        }
    },
    prompt: 'Group the avatar with the name, and call the group Profile.',
    check(document) {
        const group = groupNamed(document, /^profile$/i);

        return group && [...group.shapesIds].sort().join() === 'avatar,fullName'
            ? []
            : ['The avatar and the name are not grouped as Profile.'];
    }
} satisfies AiCase;
