import React, { Component } from 'react'
import styles from './styles.css'
import Icon from '../Icon'
import Overlay from '../Overlay'

const closeIcon = { group: 'content', name: 'clear', color: 'none', size: 18 }

const CloseButton = () => (
    <Icon {...closeIcon} className={styles.close} onClick={() => alert('ahoj')} />
)

export default class Dialog extends Component {
    constructor(props) {
        super(props)
    }
    render() {
        if (this.props.visible) {
            return (
                <div style={{width: '100%', height: '100%', position: 'absolute'}}>
                    <Overlay visible={this.props.visible} />
                    <div className={styles.dialog}>
                        <CloseButton />
                        <h4>props.title</h4>
                        <p>props.description</p>
                        <form>
                            <fieldset>
                                props.children
                            </fieldset>
                        </form>
                        <div className={styles.actions}>
                            {/*  props.actions.map(action => <button href={action} />)*/}
                            <button action="close">Close</button>
                        </div>
                    </div>
                </div>
            )
        }
        else {
            return null
        }
    }
}