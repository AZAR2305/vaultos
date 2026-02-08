import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002/api';

export const createSession = async (depositAmount: string) => {
    const response = await axios.post(`${API_BASE_URL}/session/create`, {
        depositAmount,
    });
    return response.data;
};

export const createMarket = async (question: string, description: string, durationMinutes: number, yesPrice: number) => {
    const response = await axios.post(`${API_BASE_URL}/market/create`, {
        question,
        description,
        durationMinutes,
        yesPrice,
    });
    return response.data;
};

export const buyYesShares = async (sessionId: string, marketId: string, shares: number) => {
    const response = await axios.post(`${API_BASE_URL}/trade/buy-yes`, {
        sessionId,
        marketId,
        shares,
    });
    return response.data;
};

export const buyNoShares = async (sessionId: string, marketId: string, shares: number) => {
    const response = await axios.post(`${API_BASE_URL}/trade/buy-no`, {
        sessionId,
        marketId,
        shares,
    });
    return response.data;
};

export const sellYesShares = async (sessionId: string, marketId: string, shares: number) => {
    const response = await axios.post(`${API_BASE_URL}/trade/sell-yes`, {
        sessionId,
        marketId,
        shares,
    });
    return response.data;
};

export const moveToIdle = async (sessionId: string, amount: number) => {
    const response = await axios.post(`${API_BASE_URL}/balance/move-to-idle`, {
        sessionId,
        amount,
    });
    return response.data;
};

export const accrueYield = async (sessionId: string) => {
    const response = await axios.post(`${API_BASE_URL}/balance/accrue-yield`, {
        sessionId,
    });
    return response.data;
};

export const requestRefund = async (sessionId: string) => {
    const response = await axios.post(`${API_BASE_URL}/balance/refund`, {
        sessionId,
    });
    return response.data;
};

export const checkState = async (sessionId: string) => {
    const response = await axios.get(`${API_BASE_URL}/state/${sessionId}`);
    return response.data;
};

export const closeSession = async (sessionId: string) => {
    const response = await axios.post(`${API_BASE_URL}/session/close`, {
        sessionId,
    });
    return response.data;
};
