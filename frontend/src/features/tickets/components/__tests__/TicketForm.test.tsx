import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TicketForm } from '../TicketForm';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the Zustand stores
vi.mock('../../../store/ticketStore', () => ({
  useTicketStore: () => ({
    categories: [{ id: '1', name: 'Hardware' }],
    fetchCategories: vi.fn(),
  }),
}));

vi.mock('../../../store/knowledgeStore', () => ({
  useKnowledgeStore: () => ({
    articles: [],
    fetchArticles: vi.fn(),
  }),
}));

// Mock the api
vi.mock('../../../lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

describe('TicketForm', () => {
  const queryClient = new QueryClient();

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
    
    // Check for subject input
    expect(screen.getByLabelText(/Subject/i)).toBeInTheDocument();
    
    // Check for description textarea
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    
    // Wait for categories to load
    await waitFor(() => {
      expect(screen.getByText(/Create Ticket/i)).toBeInTheDocument();
    });
  });

  it('shows validation errors when submitting empty form', async () => {
    renderComponent();
    
    const submitBtn = screen.getByRole('button', { name: /Create Ticket/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Subject must be at least 5 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Description must be at least 10 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Category is required/i)).toBeInTheDocument();
    });
  });
});
