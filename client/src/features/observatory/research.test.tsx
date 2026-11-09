import { screen, waitFor, within } from '@testing-library/react';
import { sessionToken } from '../../lib/sessionToken';
import { axeViolations, renderApp } from '../../test/utils';

describe('Workforce Observatory', () => {
  it('shows a sourced timeline labelled as sample data', async () => {
    const { container } = renderApp('/observatory');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /how work is changing/i,
    );
    expect(await screen.findByText(/sample events/i)).toBeInTheDocument();
    const timeline = await screen.findByRole('region', { name: /timeline/i });
    const events = await within(timeline).findAllByRole('heading', { level: 4 });
    expect(events.length).toBeGreaterThan(0);
    within(timeline)
      .getAllByRole('link')
      .forEach((a) => expect(a).toHaveAttribute('href', expect.stringMatching(/^https:\/\//)));
    expect(within(timeline).getAllByText(/^Evidence:/).length).toBe(events.length);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('filters by industry with a pressed-state toggle', async () => {
    const { user } = renderApp('/observatory');
    const healthcare = await screen.findByRole('button', { name: 'Healthcare' });
    await user.click(healthcare);
    expect(healthcare).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 event shown')).toBeInTheDocument();
    expect(screen.getByText(/hospital network/i)).toBeInTheDocument();
  });
});

describe('Task Scanner', () => {
  it('explains each task classification with text, not colour alone', async () => {
    const { container } = renderApp('/occupations/registered-nurse');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Registered Nurse' }),
    ).toBeInTheDocument();
    const tasks = screen.getByRole('region', { name: /tasks in this occupation/i });
    // Server `likely_change` and `exposure.level`, shown as text.
    expect(within(tasks).getByText('Partly automated')).toBeInTheDocument();
    expect(within(tasks).getByText('Augmented')).toBeInTheDocument();
    expect(within(tasks).getAllByText('Mostly human')).toHaveLength(2);
    expect(within(tasks).getByText('High exposure')).toBeInTheDocument();
    expect(within(tasks).getAllByText(/associated skills/i).length).toBeGreaterThan(0);
    // The server's own caveat: exposure is not job loss.
    expect(screen.getByText(/not job loss/i)).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('Simulate this occupation starts a journey', async () => {
    const { user } = renderApp('/occupations/accountant');
    await user.click(await screen.findByRole('button', { name: /simulate this occupation/i }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/simulate'));
    expect(sessionToken.get()).toMatch(/^fps_/);
  });

  it('handles an unknown occupation', async () => {
    renderApp('/occupations/astronaut');
    expect(
      await screen.findByRole('heading', { name: /couldn’t find that occupation/i }),
    ).toBeInTheDocument();
  });
});

describe('Methodology', () => {
  it('states principles and marks unconfirmed details honestly', async () => {
    const { container } = renderApp('/methodology');
    expect(await screen.findByRole('heading', { name: /our principles/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /how evidence is classified/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/to be completed by the research team/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/does not calculate job-loss probabilities/i)).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });
});
