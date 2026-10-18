import type { Document } from 'src/app/types';
import { ANONYMOUS } from 'src/app/factories';

/** The people a document records as its author, creator and last editor; none signed out. */
export const documentPeople = ({
    author,
    createdBy,
    modifiedBy
}: Pick<Document, 'author' | 'createdBy' | 'modifiedBy'>): string[] =>
    [author, createdBy, modifiedBy].filter((name) => name !== ANONYMOUS);
