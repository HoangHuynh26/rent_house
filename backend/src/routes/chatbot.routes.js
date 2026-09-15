import { Router } from 'express';
import * as chatbotController from '../controllers/chatbot.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Message endpoint (supports authenticated tenant, admin, or optional context)
router.post('/message', optionalAuth, chatbotController.handleChatMessage);

// Quick suggestions endpoint
router.get('/quick-suggestions', optionalAuth, chatbotController.getQuickSuggestions);

export default router;
