import type { AiCase } from '../../harness';

export default {
    fixture: {
        shapes: {
            avatar: { type: 'circle', position: { x: 60, y: 60 }, radius: 20 },
            fullName: { type: 'text', position: { x: 90, y: 50 }, value: 'Ada Lovelace' }
        },
        groups: { profile: { name: 'Profile', shapes: ['avatar', 'fullName'] } }
    },
    prompt: 'Ungroup the profile and move the name 20 pixels down.',
    check(document) {
        const { avatar, fullName } = document.shapes;

        return [
            ...(Object.keys(document.groups).length === 0 ? [] : ['The profile is grouped.']),
            ...(avatar?.type === 'circle' && avatar.position.y === 60 ? [] : ['The avatar moved.']),
            ...(fullName?.type === 'text' &&
            fullName.position.x === 90 &&
            fullName.position.y === 70
                ? []
                : ['The name is not 20 pixels down.'])
        ];
    }
} satisfies AiCase;
