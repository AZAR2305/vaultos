import { Router } from 'express';

const router = Router();

// Route to get the current state of the user's session
router.get('/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        // Return session state (mock data for now - real state is in Yellow Network)
        // In production, this would query the Yellow Network channel state
        res.json({
            success: true,
            sessionId,
            state: {
                balances: {
                    active: 0,
                    idle: 0,
                    yield: 0,
                    total: 0
                },
                positions: []
            },
            message: 'Session state retrieved (demo mode - real state managed off-chain)'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;