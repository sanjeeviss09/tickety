import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TicketForm } from '../TicketForm';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('../../../../store/authStore', () => ({
  useAuthStore: () => ({
    profile: { id: 'u1', full_name: 'Test User' },
  }),
}));

vi.mock('../../../../lib/api', () => ({
  default: {
    get: vi.fn().mockImplementation((url) => {
      if (url === '/categories') return Promise.resolve({ data: { data: [{ id: '1', name: 'Hardware', self_service_enabled: false }] } });
      if (url.startsWith('/assets')) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null })
      })
    }
  }
}));

describe('TicketForm', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TicketForm />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('renders all form fields correctly', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Hardware')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Hardware'));

    await waitFor(() => {
      expect(screen.getByLabelText(/Subject/i)).toBeInTheDocument();
    });
    
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Ticket/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Hardware')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Hardware'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Submit Ticket/i })).toBeInTheDocument();
    });
    
    const submitBtn = screen.getByRole('button', { name: /Submit Ticket/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Subject must be at least 5 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Description must be at least 10 characters/i)).toBeInTheDocument();
    });
  });
});
