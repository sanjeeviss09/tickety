import { create } from 'zustand';
import api from '../lib/api';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  category_id: string;
  status: 'Draft' | 'In Review' | 'Published' | 'Archived';
  knowledge_categories?: { name: string };
  author?: { id: string, raw_user_meta_data: any };
  article_tags?: { tag: string }[];
  views_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  updated_at: string;
}

interface KnowledgeState {
  articles: Article[];
  currentArticle: Article | null;
  categories: any[];
  faqs: any[];
  sops: any[];
  loading: boolean;
  error: string | null;
  fetchArticles: (params?: { search?: string, status?: string, category_id?: string }) => Promise<void>;
  fetchArticleBySlug: (slug: string) => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchFaqs: () => Promise<void>;
  fetchSops: () => Promise<void>;
  createArticle: (data: Partial<Article>) => Promise<void>;
  updateArticle: (id: string, data: Partial<Article>) => Promise<void>;
  rateArticle: (id: string, is_helpful: boolean, feedback?: string) => Promise<void>;
  createCategory: (data: any) => Promise<void>;
  updateCategory: (id: string, data: any) => Promise<void>;
  createFaqCategory: (data: any) => Promise<void>;
  createFaq: (data: any) => Promise<void>;
  updateFaq: (id: string, data: any) => Promise<void>;
  createSop: (data: any) => Promise<void>;
  updateSop: (id: string, data: any) => Promise<void>;
  deleteSop: (id: string) => Promise<void>;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  articles: [],
  currentArticle: null,
  categories: [],
  faqs: [],
  sops: [],
  loading: false,
  error: null,

  fetchArticles: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const query = new URLSearchParams(params as any).toString();
      const response = await api.get(`/knowledge/articles?${query}`);
      set({ articles: response.data.data });
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to fetch articles' });
    } finally {
      set({ loading: false });
    }
  },

  fetchArticleBySlug: async (slug: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/knowledge/articles/${slug}`);
      set({ currentArticle: response.data.data });
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to fetch article' });
    } finally {
      set({ loading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const response = await api.get('/knowledge/categories');
      set({ categories: response.data.data });
    } catch (error: any) {
      console.error(error);
    }
  },

  fetchFaqs: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/knowledge/faqs');
      set({ faqs: response.data.data });
    } catch (error: any) {
      console.error(error);
    } finally {
      set({ loading: false });
    }
  },

  fetchSops: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/knowledge/sops');
      set({ sops: response.data.data });
    } catch (error: any) {
      console.error(error);
    } finally {
      set({ loading: false });
    }
  },

  createArticle: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.post('/knowledge/articles', data);
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to create article' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  updateArticle: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.put(`/knowledge/articles/${id}`, data);
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to update article' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  rateArticle: async (id, is_helpful, feedback) => {
    try {
      await api.post(`/knowledge/articles/${id}/rate`, { is_helpful, feedback });
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  },

  createCategory: async (data) => {
    try {
      await api.post('/knowledge/categories', data);
      await get().fetchCategories();
    } catch (error) { console.error(error); throw error; }
  },

  updateCategory: async (id, data) => {
    try {
      await api.put(`/knowledge/categories/${id}`, data);
      await get().fetchCategories();
    } catch (error) { console.error(error); throw error; }
  },

  createFaqCategory: async (data) => {
    try {
      await api.post('/knowledge/faq-categories', data);
      await get().fetchFaqs();
    } catch (error) { console.error(error); throw error; }
  },

  createFaq: async (data) => {
    try {
      await api.post('/knowledge/faqs', data);
      await get().fetchFaqs();
    } catch (error) { console.error(error); throw error; }
  },

  updateFaq: async (id, data) => {
    try {
      await api.put(`/knowledge/faqs/${id}`, data);
      await get().fetchFaqs();
    } catch (error) { console.error(error); throw error; }
  },

  createSop: async (data) => {
    try {
      await api.post('/knowledge/sops', data);
      await get().fetchSops();
    } catch (error) { console.error(error); throw error; }
  },

  updateSop: async (id, data) => {
    try {
      await api.put(`/knowledge/sops/${id}`, data);
      await get().fetchSops();
    } catch (error) { console.error(error); throw error; }
  },

  deleteSop: async (id) => {
    try {
      await api.delete(`/knowledge/sops/${id}`);
      await get().fetchSops();
    } catch (error) { console.error(error); throw error; }
  }
}));
