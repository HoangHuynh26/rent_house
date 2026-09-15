import { Router } from 'express';
import * as roomController from '../controllers/room.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Public route for landing page
router.get('/public', roomController.getPublicRooms);

// Admin-protected routes
router.use(requireAdmin);

router.get('/', roomController.getRooms);
router.get('/:id', roomController.getRoomById);
router.post('/', roomController.createRoom);
router.patch('/:id', roomController.updateRoom);
router.delete('/:id', roomController.deleteRoom);

export default router;
