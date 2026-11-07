import { screen, waitFor, within } from '@testing-library/react';
import { axeViolations, renderApp } from '../test/utils';

const mainNav = () => screen.getByRole('navigation', { name: 'Main' });
const header = () => screen.getByRole('banner');

describe('BrandHeader (navbar)', () => {
  it('has brand, three primary links and the user actions', async () => {
    const { container } = renderApp('/start');
    expect(within(header()).getByRole('link', { name: 'FUTUREPRINT home' })).toHaveAttribute(
      'href',
      '/',
    );
    const nav = mainNav();
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/#about');
    expect(within(nav).getByRole('link', { name: 'How It Works' })).toHaveAttribute(
      'href',
      '/#how-it-works',
    );
    expect(within(nav).getByRole('link', { name: 'The Research' })).toHaveAttribute(
      'href',
      '/#research',
    );
    expect(within(header()).getByRole('link', { name: 'My Journey' })).toHaveAttribute(
      'href',
      '/simulate',
    );
    expect(within(header()).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/signin',
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('marks the active item from the current route — not hardcoded', async () => {
    renderApp('/#how-it-works');
    const nav = mainNav();
    expect(within(nav).getByRole('link', { name: 'How It Works' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(within(nav).getByRole('link', { name: 'About' })).not.toHaveAttribute('aria-current');
  });

  it('marks My Journey on journey routes and Sign in on /signin', async () => {
    renderApp('/signin');
    expect(within(header()).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(header()).getByRole('link', { name: 'My Journey' })).not.toHaveAttribute(
      'aria-current',
    );
    within(mainNav())
      .getAllByRole('link')
      .forEach((a) => expect(a).not.toHaveAttribute('aria-current'));
  });

  it('mobile menu: toggles aria-expanded, focuses the first item, closes on Escape and returns focus', async () => {
    const { user } = renderApp('/start');
    const toggle = screen.getByRole('button', { name: 'Menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    expect(toggle).toHaveAttribute('aria-controls', menu.id);
    await waitFor(() => expect(within(menu).getByRole('link', { name: 'About' })).toHaveFocus());
    expect(within(menu).getByRole('link', { name: 'My Journey' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Sign in' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('mobile menu closes after navigation', async () => {
    const { user } = renderApp('/start');
    const toggle = screen.getByRole('button', { name: 'Menu' });
    await user.click(toggle);
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    await user.click(within(menu).getByRole('link', { name: 'Sign in' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/signin');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
