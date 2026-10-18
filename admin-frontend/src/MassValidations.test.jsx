/**
 * MassValidations.test.jsx
 *
 * Mass parameterised boundary validation tests — Admin React Frontend (Vitest)
 *
 * Simulates 150 test cases spread across three boundary domains using
 * Vitest's `test.each()`:
 *
 *   Cases   1– 50 : Email-format boundary (25 valid, 25 invalid)
 *   Cases  51–100 : Password-strength boundary (25 strong, 25 weak)
 *   Cases 101–150 : Input field-length boundary (25 within limit, 25 over)
 *
 * All assertions are pure JavaScript logic — no component rendering, no
 * network calls, no DOM needed — so the suite runs in milliseconds.
 *
 * ⚠  LOCAL DEMO ONLY — this file is listed in .gitignore and must never
 *    be committed to the remote repository.
 *
 * Run with:  npm test
 */

import { describe, test, expect } from 'vitest'

// ── Pure boundary helpers ────────────────────────────────────────────────────

/** Email must contain exactly one '@' with a domain that includes a dot. */
const isEmailValid = (email) => {
  if (typeof email !== 'string') return false
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  return local.length > 0 && domain.includes('.')
}

/**
 * Password is "strong" when it meets ALL of:
 *  - Length ≥ 8
 *  - Contains at least one uppercase letter
 *  - Contains at least one digit
 */
const isPasswordStrong = (pwd) => {
  if (typeof pwd !== 'string' || pwd.length < 8) return false
  return /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)
}

/** Field value must not exceed maxLength characters. */
const isWithinMaxLength = (value, maxLength) =>
  typeof value === 'string' && value.length <= maxLength

// ── Data generators ──────────────────────────────────────────────────────────

/**
 * 50 email boundary rows (cases 1–50).
 * @returns {Array<[number, string, boolean]>} [caseNum, email, expectValid]
 */
const emailBoundaryRows = () => {
  const rows = []
  // 25 valid emails
  for (let i = 1; i <= 25; i++) {
    rows.push([i, `admin${String(i).padStart(3, '0')}@intelliprep.lk`, true])
  }
  // 13 invalid: no '@'
  for (let i = 1; i <= 13; i++) {
    rows.push([25 + i, `no-at-sign-${i}`, false])
  }
  // 12 invalid: '@' but no dot in domain
  for (let i = 1; i <= 12; i++) {
    rows.push([38 + i, `user${i}@nodot`, false])
  }
  return rows
}

/**
 * 50 password boundary rows (cases 51–100).
 * @returns {Array<[number, string, boolean]>} [caseNum, password, expectStrong]
 */
const passwordBoundaryRows = () => {
  const rows = []
  // 25 strong passwords: ≥8 chars, has uppercase + digit
  for (let i = 1; i <= 25; i++) {
    rows.push([50 + i, `StrongPass${i}!`, true])
  }
  // 13 weak: too short (< 8 chars)
  for (let i = 1; i <= 13; i++) {
    rows.push([75 + i, 'Ab1' + 'x'.repeat(i % 4), false]) // max 6 chars
  }
  // 12 weak: long but no uppercase or digit
  for (let i = 1; i <= 12; i++) {
    rows.push([88 + i, 'alllowercase' + 'a'.repeat(i), false])
  }
  return rows
}

/**
 * 50 field-length boundary rows (cases 101–150).
 * Max allowed length = 100 characters.
 * @returns {Array<[number, string, number, boolean]>} [caseNum, value, maxLen, expectValid]
 */
const fieldLengthBoundaryRows = () => {
  const rows = []
  // 25 within limit: lengths 76–100
  for (let i = 1; i <= 25; i++) {
    rows.push([100 + i, 'A'.repeat(75 + i), 100, true])  // 76–100 chars
  }
  // 25 over limit: lengths 101–125
  for (let i = 1; i <= 25; i++) {
    rows.push([125 + i, 'A'.repeat(100 + i), 100, false]) // 101–125 chars
  }
  return rows
}

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 – Email-format boundary (cases 1–50)
// ════════════════════════════════════════════════════════════════════════════
describe('Mass Validations – Email-format boundary (cases 1–50)', () => {
  test.each(emailBoundaryRows())(
    'Case %i – email "%s" → valid=%s',
    (caseNum, email, expectValid) => {
      expect(isEmailValid(email)).toBe(expectValid)
    },
  )
})

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 – Password-strength boundary (cases 51–100)
// ════════════════════════════════════════════════════════════════════════════
describe('Mass Validations – Password-strength boundary (cases 51–100)', () => {
  test.each(passwordBoundaryRows())(
    'Case %i – password "%s" → strong=%s',
    (caseNum, password, expectStrong) => {
      expect(isPasswordStrong(password)).toBe(expectStrong)
    },
  )
})

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 – Field-length boundary (cases 101–150)
// ════════════════════════════════════════════════════════════════════════════
describe('Mass Validations – Field-length boundary (cases 101–150)', () => {
  test.each(fieldLengthBoundaryRows())(
    'Case %i – length %# vs max %i → valid=%s',
    (caseNum, value, maxLen, expectValid) => {
      expect(isWithinMaxLength(value, maxLen)).toBe(expectValid)
    },
  )
})
