import React, { Component } from 'react';

import { getPropValue } from '../../../app/utils';
import styles from './styles.css';

const DocumentField = ({ name, value }) => (
    <tr>
        <td>{name}: </td>
        <td>{value}</td>
    </tr>
);

const DocumentInfo = ({ visible, document }) => (
    <table
        className={styles.workspaceInfo}
        style={!visible ? { display: 'none' } : { display: 'block' }}
    >
        <tbody>
        {Object.keys(workspace).map((name, index) => (
            <DocumentField
                key={index}
                name={name}
                value={getPropValue(workspace[name])}
            />
        ))}
        </tbody>
    </table>
);

export default connect(
    {
        visible: state`'ui.controls.workspace.visible`,
        workspace: state`workspace`
    },
    DocumentInfo
);
