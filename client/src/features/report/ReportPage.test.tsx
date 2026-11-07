import { screen, waitFor, within } from '@testing-library/react';
import { api } from '../../lib/api';
import { sessionToken } from '../../lib/sessionToken';
import { axeViolations, renderApp } from '../../test/utils';

async function completedSession() {
  const { token } = await api.createSession({ occupationId: 'graphic-designer' });
  sessionToken.set(token);
  for (let i = 0; i < 3; i++) {
    const s = await api.getCurrentSession();
    const sc = s.currentScenario!;
    await api.submitChoice({ scenarioId: sc.id, optionId: sc.options[1]!.id, step: sc.step });
  }
}

describe('My Futureprint report', () => {
  it('renders the three distinct content groups from the server response', async () => {
    await completedSession();
    const { container } = renderApp('/report');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Graphic Designer: the Transform pathway',
    );

    const choices = screen.getByRole('region', { name: /the future you explored/i });
    expect(within(choices).getByText('Your choices')).toBeInTheDocument();
    expect(within(choices).getAllByRole('listitem')).toHaveLength(3);
    expect(within(choices).getByText('Redesign the work')).toBeInTheDocument();

    const research = screen.getByRole('region', { name: /evidence behind your future/i });
    expect(within(research).getByText('What the research says')).toBeInTheDocument();
    expect(
      within(research).getByRole('heading', { name: /important limitations/i }),
    ).toBeInTheDocument();

    const suggested = screen.getByRole('region', { name: /where you could go next/i });
    expect(within(suggested).getByText('Suggested by FUTUREPRINT')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
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

  it('shows a reason for every suggestion', async () => {
    await completedSession();
    renderApp('/report');
    const suggested = await screen.findByRole('region', { name: /where you could go next/i });
    const cards = within(suggested).getAllByRole('listitem');
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((card) => expect(card).toHaveTextContent(/Why:/));
  });

  it('asks the visitor to finish the simulator when the session is incomplete', async () => {
    const { token } = await api.createSession({ occupationId: 'nurse' });
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
