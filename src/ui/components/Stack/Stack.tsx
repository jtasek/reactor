import React, { FC } from 'react';
import { useActiveToolsIds } from 'src/app/hooks';
import { getToolById } from 'src/tools/components';
import styles from './styles.css';

export const Stack: FC = () => {
    const activeToolsIds = useActiveToolsIds();

    const result =
        activeToolsIds.map((toolId: string) => getToolById(toolId)?.name).join(', ') ||
        'No tools selected';

    return <div className={styles.stack}>{result}</div>;
};
