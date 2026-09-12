import { Router } from 'express';
import { 
  getArticles, getArticleBySlug, createArticle, updateArticle, rateArticle, 
  getFaqs, getSops, getCategories,
  createCategory, updateCategory,
  createFaqCategory, createFaq, updateFaq,
  createSop, updateSop, deleteSop,
  getArticleComments, addArticleComment
} from '../controllers/knowledge.controller';
import { requireAuth, requireRole } from '../middlewares/auth';

const router = Router();

router.use(requireAuth);

router.get('/articles', getArticles);
router.get('/articles/:slug', getArticleBySlug);
router.post('/articles', requireRole(['Admin', 'Technician']), createArticle);
router.put('/articles/:id', requireRole(['Admin', 'Technician']), updateArticle);
router.post('/articles/:id/rate', rateArticle);

router.get('/articles/:id/comments', getArticleComments);
router.post('/articles/:id/comments', addArticleComment);

router.get('/categories', getCategories);
router.post('/categories', requireRole(['Admin']), createCategory);
router.put('/categories/:id', requireRole(['Admin']), updateCategory);

router.get('/faqs', getFaqs);
router.post('/faq-categories', requireRole(['Admin']), createFaqCategory);
router.post('/faqs', requireRole(['Admin']), createFaq);
router.put('/faqs/:id', requireRole(['Admin']), updateFaq);

router.get('/sops', getSops);
router.post('/sops', requireRole(['Admin']), createSop);
router.put('/sops/:id', requireRole(['Admin']), updateSop);
router.delete('/sops/:id', requireRole(['Admin']), deleteSop);

export default router;
