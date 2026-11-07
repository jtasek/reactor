import { readFileSync } from 'node:fs';
import { AUTOMATIC_TAG_TONES, TAG_TONE_LABELS, TAG_TONES } from 'src/app/tagTones';

const siteCss = readFileSync('static/styles/site.css', 'utf8');
const tagCss = readFileSync('src/ui/components/DocumentList/tags.css', 'utf8');

const property = (name: string) => {
    const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(siteCss)?.[1];
    if (!value) throw new Error(`site.css has no --${name}`);
    return value;
};

const luminance = (hex: string) => {
    const [red, green, blue] = hex
        .slice(1)
        .match(/../g)!
        .map((pair) => parseInt(pair, 16) / 255)
        .map((channel) =>
            channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (a: string, b: string) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
};

describe('tag tones', () => {
    it.each(TAG_TONES)('%s chip text meets WCAG AA on its background and on white', (tone) => {
        const text = property(`tag-${tone}-color`);

        expect(contrast(text, property(`tag-${tone}-background`))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(text, '#ffffff')).toBeGreaterThanOrEqual(4.5);
        expect(property(`tag-${tone}-swatch`)).toMatch(/^#/);
    });

    it.each(TAG_TONES)('%s has a label and a style rule', (tone) => {
        expect(TAG_TONE_LABELS[tone]).toBeTruthy();
        expect(tagCss).toContain(`.pill[data-tone='${tone}']`);
    });

    it('picks automatic tones only from the original seven, in their original order', () => {
        expect(AUTOMATIC_TAG_TONES).toEqual([
            'red',
            'orange',
            'yellow',
            'green',
            'blue',
            'purple',
            'gray'
        ]);
    });
});
