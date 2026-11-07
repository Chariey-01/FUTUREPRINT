import { screen, waitFor } from '@testing-library/react';
import * as apiModule from '../../lib/api';
import { sessionToken } from '../../lib/sessionToken';
import { axeViolations, renderApp } from '../../test/utils';

describe('Occupation selection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows a loading state, then occupation cards with title and summary', async () => {
    const { container } = renderApp('/start');
    expect(await screen.findByText(/gathering occupations/i)).toBeInTheDocument();
    const card = await screen.findByRole('button', { name: /graphic designer/i });
    expect(card).toHaveTextContent(/shapes how brands/i);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('creates a session on selection and opens the simulator', async () => {
    const { user } = renderApp('/start');
    await user.click(await screen.findByRole('button', { name: /accountant/i }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/simulate'));
    expect(sessionToken.get()).toMatch(/^mocktok_/);
    expect(await screen.findByText(/exploring the future of/i)).toHaveTextContent('Accountant');
  });

  it('shows an error state with retry when the request fails', async () => {
    vi.spyOn(apiModule.api, 'listOccupations').mockRejectedValue(
      new apiModule.ApiRequestError(0, 'NETWORK_ERROR', 'We couldn’t reach FUTUREPRINT.'),
    );
    renderApp('/start');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn’t load occupations/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows an empty state when there are no occupations', async () => {
    vi.spyOn(apiModule.api, 'listOccupations').mockResolvedValue({ items: [] });
    renderApp('/start');
    expect(await screen.findByRole('heading', { name: /no occupations yet/i })).toBeInTheDocument();
  });
});
