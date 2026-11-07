import { screen } from '@testing-library/react';
import { axeViolations, renderApp } from '../../test/utils';

describe('Future Portal', () => {
  it('renders the hero without any API call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderApp('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Explore the work that’s changing. Discover the future you could create.',
    );
    expect(screen.getByRole('link', { name: 'FUTUREPRINT home' })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Begin navigates to occupation selection', async () => {
    const { user } = renderApp('/');
    const [begin] = screen.getAllByRole('link', { name: /begin/i });
    await user.click(begin!);
    expect(screen.getByTestId('location')).toHaveTextContent('/start');
    expect(
      await screen.findByRole('heading', { name: /which future would you like to explore/i }),
    ).toBeInTheDocument();
  });

  it('Begin is reachable by keyboard', async () => {
    const { user } = renderApp('/');
    const [begin] = screen.getAllByRole('link', { name: /begin/i });
    for (let i = 0; i < 10 && document.activeElement !== begin; i++) await user.tab();
    expect(begin).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent('/start');
  });

  it('hides the decorative illustration from assistive tech and has no axe violations', async () => {
    const { container } = renderApp('/');
    container
      .querySelectorAll('svg')
      .forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
    expect(await axeViolations(container)).toEqual([]);
  });

  it('shows the mock-mode badge when mocks are enabled', () => {
    renderApp('/');
    expect(screen.getByTestId('mock-mode-badge')).toHaveTextContent(/mock mode/i);
  });
});
