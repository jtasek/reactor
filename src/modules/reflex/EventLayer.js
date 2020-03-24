/* @flow */
import React, { Component } from 'react'
import Rx from 'rx-lite'
import { findDOMNode } from 'react-dom'
import { connect } from '@cerebral/react'
import { sequences } from 'cerebral'
import { MouseButton } from '../../app/types'

// High order function to decorate component with event layer container
export default function EventLayer(DecoratedComponent) {
  const displayName =
    DecoratedComponent.displayName || DecoratedComponent.name || 'Component'

  return connect(
    {
      startDragging: sequences`reflex.startDragging`,
      dragging: sequences`reflex.dragging`,
      endDragging: sequences`reflex.endDragging`
    },
    class extends Component {
      constructor(props) {
        super(props)
        this.displayName = `EventLayer(${displayName})`
      }

      componentDidMount() {
        // register event hanlers
        const node = findDOMNode(this.refs.child)

        // Get the three major events
        const mouseup$ = Rx.Observable.fromEvent(node, 'mouseup').filter(
          e => e.button === MouseButton.left
        )

        const mousemove$ = Rx.Observable.fromEvent(node, 'mousemove').filter(
          e => e.button === MouseButton.left
        )

        const mousedown$ = Rx.Observable.fromEvent(node, 'mousedown').filter(
          e => e.button === MouseButton.left
        )

        const mousedrag$ = mousedown$.flatMap(e => {
          // Calculate offsets when mouse down
          //console.log(`start:[${e.clientX}, ${e.clientY}]`)
          let { clientX, clientY } = e

          this.props.startDragging({
            x: clientX,
            y: clientY
          })

          // Calculate delta with mousemove$ until mouseup$
          return mousemove$
            .map(({ clientX, clientY }) => {
              //console.log(`moving:[${clientX}, ${clientY}]`)

              return {
                x: clientX,
                y: clientY
              }
            })
            .takeUntil(mouseup$)
        })

        const mouseendrag$ = mouseup$.map(({ clientX, clientY }) => {
          return {
            x: clientX,
            y: clientY
          }
        })

        // Update position
        this.mousedragsubscription = mousedrag$.subscribe(pos => {
          //console.log(`move:[ ${pos.x}, ${pos.y} ]`)
          this.props.dragging(pos)
        })

        this.mouseenddragsubscription = mouseendrag$.subscribe(pos => {
          //console.log(`end:[ ${pos.x}, ${pos.y} ]`)
          this.props.endDragging(pos)
        })
      }

      componentWillUnmount() {
        // unregister event handlers
        if (this.mousedragsubscription) {
          this.mousedragsubscription.dispose()
        }

        if (this.mouseenddragsubscription) {
          this.mouseenddragsubscription.dispose()
        }
      }

      render() {
        return (
          <DecoratedComponent {...this.props} {...this.state} ref="child" />
        )
      }
    }
  )
}
