import React, { FC } from 'react';
import { Copy, SquarePlus, FileSearch } from 'lucide-react';
import { useActions, useComponents } from 'src/app/hooks';
import { useComponentLibraries } from 'src/app/componentHooks';
import { Icon } from '../Icon';
import styles from './styles.css';

const COPY_ICON = { component: Copy, size: 16 };
const INSERT_ICON = { component: SquarePlus, size: 16 };
const SOURCE_ICON = { component: FileSearch, size: 16 };

/** Imported sources and sources in other documents, without the editor's source controls. */
export const Components: FC = () => {
    const imported = Object.values(useComponents() ?? {}).filter((component) => component.library);
    const libraries = useComponentLibraries();
    const { chooseComponentToPlace, selectComponentSource, importLibraryComponent } = useActions();

    return (
        <section className={styles.components} aria-label="Library">
            <h3 className={styles.heading}>In this document</h3>
            {imported.length === 0 ? (
                <p className={styles.empty}>No library components copied here</p>
            ) : (
                <ul className={styles.list}>
                    {imported.map((component) => (
                        <li className={styles.row} key={component.id}>
                            <div className={styles.label}>
                                <strong>{component.name}</strong>
                                <small>Imported source</small>
                            </div>
                            <button
                                type="button"
                                className={styles.iconButton}
                                title={`Inspect ${component.name}`}
                                aria-label={`Inspect ${component.name}`}
                                onClick={() => selectComponentSource(component.id)}
                            >
                                <Icon icon={SOURCE_ICON} />
                            </button>
                            <button
                                type="button"
                                className={styles.iconButton}
                                title={`Place instance of ${component.name}`}
                                aria-label={`Place instance of ${component.name}`}
                                onClick={() => chooseComponentToPlace(component.id)}
                            >
                                <Icon icon={INSERT_ICON} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <h3 className={styles.heading}>Other documents</h3>
            {libraries.length === 0 ? (
                <p className={styles.empty}>Components in other documents appear here</p>
            ) : (
                <ul className={styles.list}>
                    {libraries.map((item) => (
                        <li className={styles.row} key={`${item.documentId}:${item.componentId}`}>
                            <div className={styles.label}>
                                <strong>{item.name}</strong>
                                <small>{item.documentName}</small>
                            </div>
                            {item.imported ? (
                                <small>Copied</small>
                            ) : (
                                <button
                                    type="button"
                                    className={styles.iconButton}
                                    title={`Copy ${item.name} here`}
                                    aria-label={`Copy ${item.name} here`}
                                    onClick={() =>
                                        importLibraryComponent({
                                            documentId: item.documentId,
                                            componentId: item.componentId
                                        })
                                    }
                                >
                                    <Icon icon={COPY_ICON} />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};
