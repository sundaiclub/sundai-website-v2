import { swapFirstLetters } from '../../src/app/utils/nameUtils'

describe('nameUtils', () => {
  describe('swapFirstLetters', () => {
    it('returns the original name unchanged', () => {
      const name = 'John Doe'
      const result = swapFirstLetters(name)
      expect(result).toBe('John Doe')
    })

    it('handles single names', () => {
      const name = 'John'
      const result = swapFirstLetters(name)
      expect(result).toBe('John')
    })

    it('handles empty string', () => {
      const name = ''
      const result = swapFirstLetters(name)
      expect(result).toBe('')
    })

    it('handles names with multiple spaces', () => {
      const name = 'John Michael Doe'
      const result = swapFirstLetters(name)
      expect(result).toBe('John Michael Doe')
    })

    it('handles single character names', () => {
      const name = 'J'
      const result = swapFirstLetters(name)
      expect(result).toBe('J')
    })

    it('handles names with special characters', () => {
      const name = 'Jean-Pierre Dupont'
      const result = swapFirstLetters(name)
      expect(result).toBe('Jean-Pierre Dupont')
    })
  })
})
