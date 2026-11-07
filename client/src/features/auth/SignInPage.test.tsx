import { screen } from '@testing-library/react';
import { axeViolations, renderApp } from '../../test/utils';

describe('Sign in / create account (design preview)', () => {
  it('is clearly labelled as a preview and offers guest access', async () => {
    const { container } = renderApp('/signin');
    expect(
      await screen.findByText(/design preview · accounts aren’t live yet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explore without an account/i })).toHaveAttribute(
      'href',
      '/start',
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('switches between Sign in and Create account tabs with the keyboard', async () => {
    const { user } = renderApp('/signin');
    const signinTab = await screen.findByRole('tab', { name: 'Sign in' });
    expect(signinTab).toHaveAttribute('aria-selected', 'true');
    signinTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Create account' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Create your account');
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('validates fields accessibly', async () => {
    const { user } = renderApp('/signin');
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription(/valid email address/i);
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/at least 8 characters/i);
  });

  it('never sends or stores credentials', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { user } = renderApp('/signin');
    await user.type(await screen.findByLabelText('Email'), 'visitor@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/aren’t available in this preview/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    const stored =
      JSON.stringify({ ...window.sessionStorage }) + JSON.stringify({ ...window.localStorage });
    expect(stored).not.toContain('visitor@example.com');
    expect(stored).not.toContain('correct-horse');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    fetchSpy.mockRestore();
  });

  it('explains password reset is not available yet', async () => {
    const { user } = renderApp('/signin');
    await user.click(await screen.findByRole('button', { name: /forgot password/i }));
    expect(screen.getByText(/password reset will be available/i)).toBeInTheDocument();
  });
});
