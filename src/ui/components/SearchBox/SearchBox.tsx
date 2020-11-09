import React, { FC } from 'react';
import styles from './styles.css';

export interface Props {
  filter?: string;
  onSearch: (value: string) => void;
}

export const SearchBox: FC<Props> = ({ filter, onSearch }) => (
  <div className={styles.searchBox}>
    <input
      id="q"
      name="q"
      type="search"
      placeholder="Search ..."
      value={filter}
      onChange={(e) => onSearch(e.target.value)}
    />
    <span className="input-group-btn">
      <button className="btn btn-default" type="submit">
        <span className="glyphicon glyphicon-search"></span>
      </button>
    </span>
  </div>
);
