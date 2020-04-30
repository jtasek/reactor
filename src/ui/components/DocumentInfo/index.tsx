import React, { FC } from 'react';

import { getPropValue } from '../../../app/utils';
import styles from './styles.css';

interface Props {
  name: string;
  value: any;
}

const DocumentField: FC<Props> = ({ name, value }) => (
  <tr>
    <td>{name}: </td>
    <td>{value}</td>
  </tr>
);

const DocumentInfo: FC<{ document: Document }> = ({ document }) => (
  <table className={styles.workspaceInfo}>
    <tbody>
      {Object.keys(document).map((name, index) => (
        <DocumentField key={index} name={name} value={getPropValue(workspace[name])} />
      ))}
    </tbody>
  </table>
);

export default 
    visible: state`'ui.controls.workspace.visible`,
    workspace: state`workspace`
  },
  DocumentInfo
);
