import React, { Component } from 'react'
import { connect } from '@cerebral/react'
import { props, sequences, state } from 'cerebral'
import styles from './styles.css'

const SearchBox = ({ filter, searchHandler }) => (
  <div className={styles.searchBox}>
    <input
      id="q"
      name="q"
      type="search"
      placeholder="Search ..."
      value={filter}
      onChange={e => searchHandler({ value: e.target.value })}
    />
    <span className="input-group-btn">
      <button className="btn btn-default" type="submit">
        <span className="glyphicon glyphicon-search"></span>
      </button>
    </span>
  </div>
)

export default connect(
  {
    filter: state`workspace.filter`,
    searchHandler: sequences`search`
  },
  SearchBox
)
