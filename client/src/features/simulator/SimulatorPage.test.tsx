import { screen, waitFor, within } from '@testing-library/react';
import { api } from '../../lib/api';
import { sessionToken } from '../../lib/sessionToken';
import { mockControl } from '../../mocks/mockServer';
import { axeViolations, renderApp } from '../../test/utils';

async function startSession(occupationId = 'registered-nurse') {
  const res = await api.createSession({ occupationId });
  sessionToken.set(res.token);
  return res;
}

async function choose(user: ReturnType<typeof renderApp>['user'], label: RegExp) {
  await user.click(await screen.findByRole('radio', { name: label }));
  await user.click(screen.getByRole('button', { name: /lock in/i }));
}

describe('Future Scenario Simulator', () => {
  it('asks the visitor to choose an occupation when there is no session', async () => {
    renderApp('/simulate');
    expect(await screen.findByRole('heading', { name: /hasn’t started yet/i })).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: /choose an occupation/i }),
    ).toHaveAttribute('href', '/start');
  });

  it('renders the server scenario with occupation, progress and decision cards', async () => {
    await startSession();
    const { container } = renderApp('/simulate');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'A new tool arrives' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/exploring the future of/i)).toHaveTextContent('Registered Nurse');
    expect(screen.getByTestId('step-label')).toHaveTextContent('Chapter 1 of 3');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /lock in this choice/i })).toBeDisabled();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('completes three decisions and lands on the report', async () => {
    await startSession();
    const { user } = renderApp('/simulate');
    await choose(user, /master the tool/i);
    // The previous chapter stays on screen during its short exit transition.
    await waitFor(() =>
      expect(screen.getByTestId('step-label')).toHaveTextContent('Chapter 2 of 3'),
    );
    expect(
      await screen.findByText(/choice saved — “master the tool”\. on to chapter 2\./i),
    ).toBeInTheDocument();
    // Step 2 content is whatever the server returned for the chosen branch.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The bar rises');
    await choose(user, /lead the change/i);
    await waitFor(() =>
      expect(screen.getByTestId('step-label')).toHaveTextContent('Chapter 3 of 3'),
    );
    await choose(user, /the explorer/i);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/report'));
    expect(
      await screen.findByRole('heading', { level: 1, name: /registered nurse/i }),
    ).toBeInTheDocument();
  });

  it('disables cards and the submit button while a choice is being saved', async () => {
    await startSession();
    mockControl.setLatency(150);
    const { user } = renderApp('/simulate');
    await user.click(await screen.findByRole('radio', { name: /redesign the work/i }));
    await user.click(screen.getByRole('button', { name: /lock in/i }));

    const radios = screen.getAllByRole('radio');
    radios.forEach((r) => expect(r).toBeDisabled());
    expect(screen.getByRole('button', { name: /lock in/i })).toBeDisabled();
    expect(screen.getByText('Saving your choice…')).toBeInTheDocument();
    expect(await screen.findByText('Your pilot works')).toBeInTheDocument();
  });

  it('prevents duplicate submissions from rapid clicks', async () => {
    await startSession();
    mockControl.setLatency(100);
    const spy = vi.spyOn(api, 'submitChoice');
    const { user } = renderApp('/simulate');
    await user.click(await screen.findByRole('radio', { name: /master the tool/i }));
    const btn = screen.getByRole('button', { name: /lock in/i });
    await Promise.all([user.click(btn), user.click(btn), user.click(btn)]);
    await screen.findByText('The bar rises');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('re-syncs with the server on a stale step', async () => {
    await startSession();
    const { user } = renderApp('/simulate');
    await screen.findByText('A new tool arrives');
    // Another tab answers step 1 behind this tab's back.
    const s = await api.getCurrentSession();
    await api.submitChoice({ optionId: s.currentScenario!.options[2]!.id });

    // This tab's choice no longer belongs to the current scenario: the server answers
    // 422 invalid_choice, which the client treats as a stale step and re-syncs.
    await choose(user, /master the tool/i);
    expect(await screen.findByRole('alert')).toHaveTextContent(/already answered/i);
    // Shows the server's actual step 2 (Discover branch), not the one this tab tried.
    expect(await screen.findByText('An unexpected door')).toBeInTheDocument();
    expect(screen.getByTestId('step-label')).toHaveTextContent('Chapter 2 of 3');
  });

  it('resumes the current step after a page refresh', async () => {
    await startSession('accountant');
    const first = renderApp('/simulate');
    await choose(first.user, /follow your curiosity/i);
    await screen.findByText('An unexpected door');
    first.unmount();

    // Fresh app + fresh cache, token re-read from sessionStorage: like a reload.
    sessionToken.reload();
    renderApp('/simulate');
    expect(await screen.findByText('An unexpected door')).toBeInTheDocument();
    expect(screen.getByTestId('step-label')).toHaveTextContent('Chapter 2 of 3');
  });

  it('handles an expired session gracefully', async () => {
    await startSession();
    mockControl.expireAll();
    renderApp('/simulate');
    expect(
      await screen.findByRole('heading', { name: /journey has expired/i }),
    ).toBeInTheDocument();
    expect(sessionToken.get()).toBeNull();
    expect(screen.getByRole('link', { name: /start a new journey/i })).toHaveAttribute(
      'href',
      '/start',
    );
  });

  it('handles a session that expires mid-journey on submit', async () => {
    await startSession();
    const { user } = renderApp('/simulate');
    await screen.findByText('A new tool arrives');
    mockControl.expireAll();
    await choose(user, /master the tool/i);
    expect(
      await screen.findByRole('heading', { name: /journey has expired/i }),
    ).toBeInTheDocument();
  });

  it('supports keyboard selection with arrow keys', async () => {
    await startSession();
    const { user } = renderApp('/simulate');
    const first = await screen.findByRole('radio', { name: /master the tool/i });
    first.focus();
    await user.keyboard('{ArrowRight}');
    const group = screen.getByRole('group', { name: /choose how you would respond/i });
    expect(within(group).getByRole('radio', { name: /redesign the work/i })).toBeChecked();
  });
});
