/**
 * AdminLogin.test.jsx
 *
 * Viva demonstration test — renders the AdminLogin page in isolation
 * and asserts the key UI elements are visible without any network calls.
 *
 * Run with:  npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminLogin from './AdminLogin'

// ── Stub useNavigate so the component doesn't need a real router history ──
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => vi.fn() }
})

describe('AdminLogin page', () => {
  const renderComponent = () =>
    render(
      <MemoryRouter>
        <AdminLogin />
      </MemoryRouter>,
    )

  it('displays the IntelliPrep brand name', () => {
    renderComponent()
    // The Brand component renders "IntelliPrep." in multiple places on the page.
    // Use getAllByText and assert at least one element is in the document.
    const matches = screen.getAllByText(/IntelliPrep/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders the "Sign in to your workspace" heading', () => {
    renderComponent()
    expect(
      screen.getByRole('heading', { name: /sign in to your workspace/i }),
    ).toBeInTheDocument()
  })

  it('renders the email address input field', () => {
    renderComponent()
    expect(
      screen.getByPlaceholderText(/enter your email address/i),
    ).toBeInTheDocument()
  })

  it('renders the password input field', () => {
    renderComponent()
    expect(
      screen.getByPlaceholderText(/enter your password/i),
    ).toBeInTheDocument()
  })

  it('renders the Sign in submit button', () => {
    renderComponent()
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument()
  })
})
