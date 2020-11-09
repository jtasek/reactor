import React, { FC } from 'react';
import styles from './styles.css';
import { Document } from 'src/app/types';
import { DocumentInfoField } from './DocumentInfoField';
import { getPropValue } from 'src/app/utils';

export interface Props {
  document?: Document;
}

export const DocumentInfo: FC<Props> = ({ document }) => {
  if (!document) {
    return null;
  }

  return (
    <table className={styles.documentInfo}>
      <tbody>
        {Object.keys(document).map((name, index) => (
          <DocumentInfoField key={index} name={name} value={getPropValue(document[name])} />
        ))}
      </tbody>
    </table>
  );
};
