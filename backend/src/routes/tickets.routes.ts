import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { 
  getTickets, createTicket, getTicketById, 
  updateTicketStatus, assignTicket, addComment, 
  getComments, getTimeline, deleteComment, deleteTicket,
  getEligibleTechnicians
} from '../controllers/tickets.controller';
import {
  startWork, completeWork, confirmResolution,
  waitForUser, employeeReply,
  getWorkSummary, getResolution, addAttachment, getAttachments,
} from '../controllers/ticketWorkflow.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getTickets);
router.post('/', createTicket);
router.get('/:id', getTicketById);
router.delete('/:id', deleteTicket);
router.patch('/:id/status', requireRole(['Admin']), updateTicketStatus);
router.post('/:id/assign', requireRole(['Admin']), assignTicket);
router.get('/:id/eligible-technicians', requireRole(['Admin', 'Technician']), getEligibleTechnicians);

router.get('/:id/comments', getComments);
router.post('/:id/comments', addComment);
router.delete('/:id/comments/:commentId', deleteComment);

router.get('/:id/timeline', getTimeline);

// ── Technician Workflow ────────────────────────────────────────────────────────
router.post('/:id/start-work', requireRole(['Technician']), startWork);
router.post('/:id/complete', requireRole(['Technician']), completeWork);
router.post('/:id/wait-for-user', requireRole(['Technician']), waitForUser);
router.post('/:id/employee-reply', requireRole(['Employee']), employeeReply);
router.post('/:id/confirm-resolution', requireRole(['Employee']), confirmResolution);

// ── Work summary + Resolution details (all authenticated) ─────────────────────
router.get('/:id/work-summary', getWorkSummary);
router.get('/:id/resolution', getResolution);

// ── Attachments ───────────────────────────────────────────────────────────────
router.get('/:id/attachments', getAttachments);
router.post('/:id/attachments', requireRole(['Admin', 'Technician']), addAttachment);

export default router;
