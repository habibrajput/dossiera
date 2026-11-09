import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoginForm } from '@/components/auth/login-form';

const replaceMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  it('renders only a password credential field', () => {
    const { container } = render(<LoginForm returnTo="/dashboard" />);

    const inputs = container.querySelectorAll('input');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('submits the password with cookies and returns to the protected page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<LoginForm returnTo="/settings?tab=ai" />);

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/settings?tab=ai'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ password: 'secret' }),
      })
    );
    vi.unstubAllGlobals();
  });

  it('shows an error and does not navigate after a rejected password', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<LoginForm returnTo="/dashboard" />);

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Incorrect password. Please try again.')).toBeVisible();
    expect(replaceMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
