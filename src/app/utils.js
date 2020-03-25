
import type {Point, Rectangle, Vector} from './types'

export function getRandomNumber(max: number): number {
	return Math.floor(Math.random() * max)
}

export function getRandomColor(): string {
	return `rgb(${getRandomNumber(255)}, ${getRandomNumber(255)}, ${getRandomNumber(255)})`
}

export function pointInRectangle(m: Point, r: Rectangle): boolean {
	const AB = vector(r.A, r.B)
	const AM = vector(r.A, m)
	const BC = vector(r.B, r.C)
	const BM = vector(r.B, m)

	const dotABAM = dot(AB, AM)
	const dotABAB = dot(AB, AB)
	const dotBCBM = dot(BC, BM)
	const dotBCBC = dot(BC, BC)

	return 0 <= dotABAM && dotABAM <= dotABAB && 0 <= dotBCBM && dotBCBM <= dotBCBC
}

export function getPropValue(prop) {
    // console.log(typeof prop)
    if (typeof prop === 'object') {
        if (prop instanceof Array) {
            return prop.length
        }
        return '[object]'
    }
    else if (typeof prop === 'function') {
        return '[function]'
    }
    return prop.toString()
}

function vector(p1: Point, p2: Point): Vector {
	return {
		x: (p2.x - p1.x),
		y: (p2.y - p1.y)
	}
}

function dot(u: Point, v: Point): number {
	return u.x * v.x + u.y * v.y
}