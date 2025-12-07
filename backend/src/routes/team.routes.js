import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(requireAuth);

// TODO: Implement team routes
router.get('/', async (req, res) => {
    res.status(501).json({ error: 'Team routes not yet implemented' });
});

export default router;
