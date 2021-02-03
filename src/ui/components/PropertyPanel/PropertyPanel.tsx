import React, { FC } from 'react';
import styles from './styles.css';
import { getCommonProperties } from './service';
import { PropertyList } from './PropertyList';
import { Shape } from 'src/app/types';

export interface Props {
  shapes?: Shape[];
}

export const PropertyPanel: FC<Props> = ({ shapes }) => {
  if (!shapes) {
    return null;
  }

  return (
    <table className={styles.propertyPanel}>
      <thead>
        <tr>
          <td>field</td>
          <td>value</td>
        </tr>
      </thead>
      <tbody>
        <PropertyList key="properties" items={getCommonProperties(shapes)} />
      </tbody>
      <tfoot>
        <tr>
          <td>Selected: </td>
          <td>{shapes.length}</td>
        </tr>
      </tfoot>
    </table>
  );
};
