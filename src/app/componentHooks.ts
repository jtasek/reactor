// Only the editor page shows components, so these hooks load with it rather than
// with `hooks.ts`, which every page needs as it opens.
import { useAppState } from './hooks';
import { hoveredComponentsIds } from './componentSelection';
import { isShapeLocked } from './utils';
import { selectedComponentContext } from './componentTree';
import { screenViewName } from './screenViews';
import {
    componentCandidates,
    componentLibraries,
    instanceProperties,
    libraryUpdateAvailable
} from './computed/componentPanels';

export const useInstanceProperties = () =>
    useAppState((state) => instanceProperties(state.currentDocument));

export const useComponentLibraries = () => useAppState(componentLibraries);

export const useLibraryUpdateAvailable = (componentId: string) =>
    useAppState((state) => libraryUpdateAvailable(state, componentId));

export const useComponentCandidates = (componentId: string) =>
    useAppState((state) => componentCandidates(state.currentDocument, componentId));

export const useSelectedComponentContext = () =>
    useAppState((state) =>
        selectedComponentContext(
            state.currentDocument,
            state.selectedComponent?.documentId === state.currentDocumentId
                ? state.selectedComponent
                : null
        )
    );

export const useComponentExposure = (componentId: string | null, shapeId: string | null) =>
    useAppState((state) => {
        if (!componentId || !shapeId) {
            return null;
        }
        const document = state.currentDocument;
        const component = document.components[componentId];
        const shape = document.shapes[shapeId];

        if (!component || !shape) {
            return null;
        }

        return {
            candidates: componentCandidates(document, componentId).filter(
                (candidate) => candidate.shapeId === shapeId
            ),
            props: component.props ?? [],
            disabled: Boolean(document.locked || component.locked || component.library)
        };
    });

export const useEditingComponentId = () => useAppState((state) => state.enteredComponentId);

export const useEditingComponentForShape = (shapeId: string) =>
    useAppState((state) => {
        const id = state.enteredComponentId;

        return id && state.currentDocument.components[id]?.shapesIds.includes(shapeId) ? id : null;
    });

export const useComponentEditingViewName = () =>
    useAppState((state) => {
        const document = state.currentDocument;
        const address = state.events.pointer.screenView ?? state.componentEditingReturn?.screenView;
        const view =
            address?.documentId === document.id ? document.frames[address.viewId] : undefined;

        return view ? screenViewName(document, view) : null;
    });

export const useEditingComponentName = () =>
    useAppState((state) =>
        state.enteredComponentId
            ? state.currentDocument.components[state.enteredComponentId]?.name
            : undefined
    );

export const useComponent = (componentId: string) =>
    useAppState((state) => state.currentDocument.components[componentId]);

export const useSourceSelected = (componentId: string | null) =>
    useAppState(
        (state) =>
            componentId !== null &&
            (state.currentDocument.selectedComponentsIds.includes(componentId) ||
                (state.selectedComponent?.documentId === state.currentDocumentId &&
                    state.selectedComponent.componentId === componentId &&
                    !state.selectedComponent.shapeId))
    );

export const useSelectedComponentsIds = () =>
    useAppState((state) => state.currentDocument.selectedComponentsIds);

export const useHoveredComponentsIds = () =>
    useAppState((state) =>
        hoveredComponentsIds(state.currentDocument, state.enteredComponentId, state.events.pointer)
    );

export const useComponentLocked = (id: string) =>
    useAppState((state) => {
        const document = state.currentDocument;
        const component = document.components[id];
        return (
            !component || component.shapesIds.some((shapeId) => isShapeLocked(document, shapeId))
        );
    });
