/** CIE76 distance in D65 Lab, from sRGB hex colors. Not a perceptual screenshot similarity score. */
export function colorDistance(first: string, second: string) {
    const lab = (hex: string) => {
        const [r, g, b] = [1, 3, 5].map((offset) => {
            const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;

            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        const transform = (value: number) =>
            value > 216 / 24389 ? Math.cbrt(value) : ((24389 / 27) * value + 16) / 116;
        const x = transform((r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047);
        const y = transform(r * 0.2126729 + g * 0.7151522 + b * 0.072175);
        const z = transform((r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883);

        return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    };
    const a = lab(first);
    const b = lab(second);

    return Math.hypot(...a.map((value, index) => value - b[index]));
}
