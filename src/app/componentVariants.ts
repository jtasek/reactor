import type { Component, Document, RoleSettings } from './types';
import { exposableProperties, resolveComponentProp } from './componentProps';
import { componentSource } from './componentSource';
import { effectiveRoleSettings, roleLinks } from './componentRoles';

/** Same role, same role links (in any key order) and, for buttons, the same target. */
export function sameRoleSettings(expected: RoleSettings, actual: RoleSettings): boolean {
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

const sameInteraction = (family: Component, alternate: Component) =>
    sameRoleSettings(effectiveRoleSettings(family), effectiveRoleSettings(alternate));

/**
 * Whether componentSource would find artwork, without building it: any drawable member is
 * enough, and only sources made purely of nested instances need the full walk.
 */
function hasArtwork(document: Document, componentId: string) {
    const component = document.components[componentId];
    if (!component) {
        return false;
    }

    return (
        component.shapesIds.some((id) => {
            const shape = component.sourceShapes?.[id] ?? document.shapes[id];

            return shape && shape.type !== 'instance';
        }) || Boolean(componentSource(document, componentId))
    );
}

/** Whether a component's exposed property still points at a field its source can expose. */
function usableProp(document: Document, component: Component, propId: string, shapeId: string) {
    const resolved = resolveComponentProp(component, propId, document);

    return Boolean(
        resolved &&
        component.shapesIds.includes(shapeId) &&
        exposableProperties(resolved.source, document).includes(resolved.property)
    );
}

/** Problems with the default itself; they apply to every alternate in its family. */
export function componentDefaultProblems(document: Document, familyId: string): string[] {
    const family = document.components[familyId];

    return (family?.props ?? [])
        .filter((prop) => !usableProp(document, family, prop.id, prop.shapeId))
        .map(
            (prop) =>
                `The default’s property “${prop.label}” has no compatible source field. Repair the default source first.`
        );
}

/** Problems with one alternate, leaving out the default's own (see componentDefaultProblems). */
export function componentAlternateProblems(
    document: Document,
    familyId: string,
    variantId: string,
    /** False when the caller already knows no family links the variant. */
    checkFamilies = true
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
        checkFamilies &&
        Object.values(document.components).some(
            (component) => component.id !== familyId && component.variantIds?.includes(variantId)
        )
    ) {
        problems.push('This variant belongs to another family. Unlink it from one family.');
    }
    if (!hasArtwork(document, variantId)) {
        problems.push('This variant has no usable artwork. Edit its source to restore it.');
    }
    for (const prop of family.props ?? []) {
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
        if (!usableProp(document, alternate, other.id, other.shapeId)) {
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

    return [...new Set(problems)];
}

/** Read-only diagnostics: source edits never rewrite variant choices or instance overrides. */
export function componentVariantProblems(
    document: Document,
    familyId: string,
    variantId: string
): string[] {
    const alternate = componentAlternateProblems(document, familyId, variantId);
    if (!document.components[familyId] || !document.components[variantId]) {
        return alternate;
    }

    return [...new Set([...componentDefaultProblems(document, familyId), ...alternate])];
}

/** Whether `familyId` can take alternates at all: checked once, then per candidate. */
function canHaveVariants(document: Document, familyId: string) {
    const family = document.components[familyId];

    return Boolean(
        !document.locked &&
        family &&
        !family.locked &&
        !family.library &&
        !Object.values(document.components).some((item) => item.variantIds?.includes(familyId)) &&
        hasArtwork(document, familyId) &&
        componentDefaultProblems(document, familyId).length === 0
    );
}

/**
 * Quick checks that rule most components out without building their artwork. The full
 * check (componentAlternateProblems) still runs for whatever passes.
 */
function mightLink(family: Component, alternate: Component, linked: ReadonlySet<string>) {
    const props = family.props ?? [];
    const other = alternate.props ?? [];

    return (
        alternate.id !== family.id &&
        !alternate.locked &&
        !alternate.library &&
        !alternate.variantIds?.length &&
        !linked.has(alternate.id) &&
        props.length === other.length &&
        props.every((prop) =>
            other.some((candidate) => candidate.id === prop.id && candidate.key === prop.key)
        ) &&
        sameInteraction(family, alternate)
    );
}

const linkedComponents = (document: Document) =>
    new Set(Object.values(document.components).flatMap((item) => item.variantIds ?? []));

/** Linking and the source picker use the same compatibility checks. */
export function canLinkComponentVariant(document: Document, familyId: string, variantId: string) {
    const alternate = document.components[variantId];

    return Boolean(
        alternate &&
        canHaveVariants(document, familyId) &&
        mightLink(document.components[familyId], alternate, linkedComponents(document)) &&
        componentAlternateProblems(document, familyId, variantId).length === 0
    );
}

/** Every component `familyId` could link as an alternate, checking the family only once. */
export function componentVariantCandidates(document: Document, familyId: string): Component[] {
    if (!canHaveVariants(document, familyId)) {
        return [];
    }
    const family = document.components[familyId];
    const linked = linkedComponents(document);

    return Object.values(document.components).filter(
        (candidate) =>
            mightLink(family, candidate, linked) &&
            componentAlternateProblems(document, familyId, candidate.id, false).length === 0
    );
}
