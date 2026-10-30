import type { Component, Document } from './types';
import { exposableProperties, resolveComponentProp } from './componentProps';
import { componentSource } from './componentSource';
import { effectiveRoleSettings, roleLinks } from './componentRoles';

function sameInteraction(family: Component, alternate: Component): boolean {
    const expected = effectiveRoleSettings(family);
    const actual = effectiveRoleSettings(alternate);
    if (expected.role !== actual.role) {
        return false;
    }
    if (expected.role === 'none') {
        return true;
    }
    const expectedLinks = roleLinks(expected.role, expected.props);
    const actualLinks = roleLinks(actual.role, actual.props);

    return (
        expected.navigateTo === actual.navigateTo &&
        Object.keys(expectedLinks).length === Object.keys(actualLinks).length &&
        Object.entries(expectedLinks).every(([key, value]) => actualLinks[key] === value)
    );
}

/** Read-only diagnostics: source edits never rewrite variant choices or instance overrides. */
export function componentVariantProblems(
    document: Document,
    familyId: string,
    variantId: string
): string[] {
    const family = document.components[familyId];
    const alternate = document.components[variantId];
    if (!family || !alternate) {
        return ['This variant is unavailable. Instances use the default source.'];
    }
    const problems: string[] = [];
    if (variantId === familyId || alternate.variantIds?.length) {
        problems.push('A variant must be a single source, without variants of its own.');
    }
    if (
        Object.values(document.components).some(
            (component) => component.id !== familyId && component.variantIds?.includes(variantId)
        )
    ) {
        problems.push('This variant belongs to another family. Unlink it from one family.');
    }
    if (!componentSource(document, variantId)) {
        problems.push('This variant has no usable artwork. Edit its source to restore it.');
    }
    for (const prop of family.props ?? []) {
        const original = resolveComponentProp(family, prop.id, document);
        if (
            !original ||
            !family.shapesIds.includes(prop.shapeId) ||
            !exposableProperties(original.source, document).includes(original.property)
        ) {
            problems.push(
                `The default’s property “${prop.label}” has no compatible source field. Repair the default source first.`
            );

            continue;
        }
        const other = alternate.props?.find((candidate) => candidate.id === prop.id);
        if (!other) {
            problems.push(
                `Missing property “${prop.label}”. Its instance override is kept but cannot apply here.`
            );

            continue;
        }
        if (other.key !== prop.key) {
            problems.push(
                `Property “${prop.label}” uses ${other.key} instead of ${prop.key}. Restore its original field mapping.`
            );

            continue;
        }
        const resolved = resolveComponentProp(alternate, other.id, document);
        if (
            !resolved ||
            !alternate.shapesIds.includes(other.shapeId) ||
            !exposableProperties(resolved.source, document).includes(resolved.property)
        ) {
            problems.push(
                `Property “${prop.label}” has no compatible source field. Edit the variant to restore it.`
            );
        }
    }
    for (const prop of alternate.props ?? []) {
        if (!family.props?.some((candidate) => candidate.id === prop.id)) {
            problems.push(
                `Property “${prop.label}” is not shared with the default. Expose shared properties from the family.`
            );
        }
    }
    if (!sameInteraction(family, alternate)) {
        problems.push(
            'Role or action settings differ from the default. Family instances keep the default’s role and action unless explicitly overridden.'
        );
    }

    return problems;
}

/** Linking and the source picker use the same compatibility checks. */
export function canLinkComponentVariant(document: Document, familyId: string, variantId: string) {
    const family = document.components[familyId];
    const alternate = document.components[variantId];

    return Boolean(
        !document.locked &&
        family &&
        alternate &&
        !family.locked &&
        !family.library &&
        !alternate.locked &&
        !alternate.library &&
        !family.variantIds?.includes(variantId) &&
        !Object.values(document.components).some((item) => item.variantIds?.includes(familyId)) &&
        componentSource(document, familyId) &&
        componentVariantProblems(document, familyId, variantId).length === 0
    );
}
