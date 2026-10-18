import type * as Dimensions from '../variableDimensionEdits';
import { editorHelpers } from '../editorHelpers';

export const createDimension: typeof Dimensions.createDimension = (context, input) =>
    editorHelpers().dimensions.createDimension(context, input);

export const updateDimension: typeof Dimensions.updateDimension = (context, input) =>
    editorHelpers().dimensions.updateDimension(context, input);

export const addDimensionMode: typeof Dimensions.addDimensionMode = (context, input) =>
    editorHelpers().dimensions.addDimensionMode(context, input);

export const deleteDimensionMode: typeof Dimensions.deleteDimensionMode = (context, input) =>
    editorHelpers().dimensions.deleteDimensionMode(context, input);

export const deleteDimension: typeof Dimensions.deleteDimension = (context, input) =>
    editorHelpers().dimensions.deleteDimension(context, input);

export const setVariableDimension: typeof Dimensions.setVariableDimension = (context, input) =>
    editorHelpers().dimensions.setVariableDimension(context, input);

export const setVariableModeValue: typeof Dimensions.setVariableModeValue = (context, input) =>
    editorHelpers().dimensions.setVariableModeValue(context, input);

export const setPreviewMode: typeof Dimensions.setPreviewMode = (context, input) =>
    editorHelpers().dimensions.setPreviewMode(context, input);
