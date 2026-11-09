import { screen, waitFor, within } from '@testing-library/react';
import { api } from '../../lib/api';
import { sessionToken } from '../../lib/sessionToken';
import { axeViolations, renderApp } from '../../test/utils';

async function completedSession() {
  const { token } = await api.createSession({ occupationId: 'graphic-designer' });
  sessionToken.set(token);
  for (let i = 0; i < 3; i++) {
    const s = await api.getCurrentSession();
    await api.submitChoice({ optionId: s.currentScenario!.options[1]!.id });
  }
}

describe('My Futureprint report', () => {
  it('renders the three distinct content groups from the server response', async () => {
    await completedSession();
    const { container } = renderApp('/report');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Graphic Designer: the Transform pathway',
    );
    // The server's reason for the leading pathway.
    expect(screen.getByText(/why this pathway/i).parentElement).toHaveTextContent(
      /leading pathway because you chose/i,
    );

    const choices = screen.getByRole('region', { name: /the future you explored/i });
    expect(within(choices).getByText('Your choices')).toBeInTheDocument();
    expect(within(choices).getAllByText(/^Chapter \d ·/)).toHaveLength(3);
    expect(within(choices).getByText('Redesign the work')).toBeInTheDocument();
    // Server feedback on each choice is shown in the timeline.
    expect(within(choices).getAllByText(/\[Mock feedback\]/)).toHaveLength(3);

    const research = screen.getByRole('region', { name: /evidence behind your future/i });
    expect(within(research).getByText('What the research says')).toBeInTheDocument();

    const suggested = screen.getByRole('region', { name: /where you could go next/i });
    expect(within(suggested).getByText('Suggested by FUTUREPRINT')).toBeInTheDocument();
    expect(
      within(suggested).getByRole('heading', { name: /next steps on the transform pathway/i }),
    ).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  }, 60_000); // the full report is large; axe in jsdom needs more than the default

  it('always shows the server disclaimer', async () => {
    await completedSession();
    renderApp('/report');
    const note = await screen.findByRole('complementary', { name: /about this report/i });
    expect(note).toHaveTextContent(/not a prediction/i);
  });

  it('offers print / save as PDF', async () => {
    await completedSession();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { user } = renderApp('/report');
    await user.click(await screen.findByRole('button', { name: /print or save as pdf/i }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('links every research finding to its source in a new tab', async () => {
    await completedSession();
    renderApp('/report');
    const research = await screen.findByRole('region', { name: /evidence behind your future/i });
    const links = within(research).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => {
      expect(a.getAttribute('href')).toMatch(/^https:\/\//);
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
      expect(a).toHaveAccessibleName(/opens in a new tab/i);
    });
  });

  it('shows a reason for every suggestion, skill and alternative pathway', async () => {
    await completedSession();
    renderApp('/report');
    const suggested = await screen.findByRole('region', { name: /where you could go next/i });
    const items = within(suggested).getAllByTestId('reasoned-item');
    // 3 suggestions + 1 transferable skill + 2 other pathways in the mock.
    expect(items).toHaveLength(6);
    items.forEach((item) => expect(item).toHaveTextContent(/Why:/));
  });

  it('asks the visitor to finish the simulator when the session is incomplete', async () => {
    const { token } = await api.createSession({ occupationId: 'registered-nurse' });
    sessionToken.set(token);
    renderApp('/report');
    expect(await screen.findByRole('heading', { name: /almost there/i })).toBeInTheDocument();
  });

  it('replay starts a new journey', async () => {
    await completedSession();
    const { user } = renderApp('/report');
    await user.click(await screen.findByRole('button', { name: /replay the journey/i }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/start'));
    expect(sessionToken.get()).toBeNull();
  });
});

describe('Shared report (/r/:token)', () => {
  it('opens a read-only report from its share token, without the session', async () => {
    await completedSession();
    const { shareToken } = await api.createReport();
    sessionToken.clear(); // a different visitor: no session at all
    const { container } = renderApp(`/r/${shareToken}`);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Graphic Designer: the Transform pathway',
    );
    expect(screen.getByText(/a shared futureprint/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /replay the journey/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy share link/i })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /about this report/i })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('explains an unknown share link', async () => {
    renderApp('/r/not-a-real-token');
    expect(
      await screen.findByRole('heading', { name: /couldn’t find that report/i }),
    ).toBeInTheDocument();
  });
});
