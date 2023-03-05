import React, { FC } from 'react';
import { useTools } from 'src/app/hooks';
import { getToolById } from 'src/tools/components';
import styles from './styles.css';

export const Stack: FC = () => {
  const { activeToolsIds } = useTools();

  const result =
    activeToolsIds.map((toolId) => getToolById(toolId)?.name).join(', ') || 'No tools selected';

  return <div className={styles.stack}>{result}</div>;
};
