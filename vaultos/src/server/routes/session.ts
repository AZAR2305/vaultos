import { Router } from 'express';
import sessionService from '../services/SessionService';

const router = Router();

// Create a new trading session with wallet address
// Accepts optional existingChannelId to resume channel after page reload
router.post('/create', async (req, res) => {
    const { walletAddress, depositAmount, existingChannelId } = req.body;
    try {
        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }
        
        // Pass existingChannelId for channel recovery
        const session = await sessionService.createSession(
            walletAddress, 
            depositAmount, 
            existingChannelId
        );
        
        // Return serializable session data (exclude yellowClient)
        const { yellowClient, ...serializableSession } = session;
        res.status(201).json({ success: true, session: serializableSession });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Close an existing trading session
router.post('/close', async (req, res) => {
    const { sessionId } = req.body;
    try {
        const result = await sessionService.closeSession(sessionId);
        res.status(200).json({ success: true, finalBalance: result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get session info
router.get('/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = sessionService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Return serializable session data (exclude yellowClient)
        const { yellowClient, ...serializableSession } = session;
        res.status(200).json({ success: true, session: serializableSession });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Add funds to existing channel
router.post('/deposit', async (req, res) => {
    const { sessionId, amount } = req.body;
    try {
        if (!sessionId || !amount) {
            return res.status(400).json({ error: 'sessionId and amount required' });
        }
        
        const result = await sessionService.depositToChannel(sessionId, amount);
        res.status(200).json({ success: true, ...result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Withdraw from existing channel
router.post('/withdraw', async (req, res) => {
    const { sessionId, amount } = req.body;
    try {
        if (!sessionId || !amount) {
            return res.status(400).json({ error: 'sessionId and amount required' });
        }
        
        const result = await sessionService.withdrawFromChannel(sessionId, amount);
        res.status(200).json({ success: true, ...result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Export the router
export default router;