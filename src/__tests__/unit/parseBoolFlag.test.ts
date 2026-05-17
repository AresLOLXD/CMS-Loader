import { describe, it, expect } from 'vitest'
import { parseBoolFlag } from '../../utils/parseBoolFlag'

describe('parseBoolFlag', () => {
    it.each([['true'], ['TRUE'], ['True']])('returns true for "%s"', (value) => {
        expect(parseBoolFlag(value, 'field')).toBe(true)
    })

    it('returns true for "1"', () => {
        expect(parseBoolFlag('1', 'field')).toBe(true)
    })

    it.each([['false'], ['FALSE']])('returns false for "%s"', (value) => {
        expect(parseBoolFlag(value, 'field')).toBe(false)
    })

    it('returns false for "0"', () => {
        expect(parseBoolFlag('0', 'field')).toBe(false)
    })

    it.each([['yes'], [''], ['2'], ['null']])('throws for "%s"', (value) => {
        expect(() => parseBoolFlag(value, 'myField')).toThrow()
    })

    it('includes the value and field name in the thrown error message', () => {
        expect(() => parseBoolFlag('invalid', 'myField')).toThrow('invalid')
        expect(() => parseBoolFlag('invalid', 'myField')).toThrow('myField')
    })
})
