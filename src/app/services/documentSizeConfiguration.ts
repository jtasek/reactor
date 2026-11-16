/** Kept apart from the measure, which only lazily loaded code uses, so startup loads just these. */
const MIB = 1024 * 1024;

export interface DocumentSizeConfiguration {
    /** From this size of shared state, the editor warns that the document is growing too large. */
    warningBytes: number;
    /** The largest state sent in a document's first sync; at most `MAX_UPLOAD_BYTES`. */
    uploadBytes: number;
    measureEveryMs: number;
    /** Measuring a large document reads it into a new copy, about 150 ms at 3 MB of shapes. */
    measureLargeEveryMs: number;
    /** How long after a change a document held back as too large is measured again. */
    remeasureHeldBackMs: number;
}

/** The server's largest message (`MAX_MESSAGE` in server/sync.ts) less room for the id; a larger limit would not be taken. */
export const MAX_UPLOAD_BYTES = 4 * MIB - 1024;

export const DEFAULT_DOCUMENT_SIZE: DocumentSizeConfiguration = {
    warningBytes: 3 * MIB,
    uploadBytes: MAX_UPLOAD_BYTES,
    measureEveryMs: 2000,
    measureLargeEveryMs: 15_000,
    remeasureHeldBackMs: 5000
};
