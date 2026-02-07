// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title YellowPredictionRegistry
 * @notice Minimal on-chain coordination layer for Yellow Network prediction markets
 * @dev This contract does NOT hold funds - it acts as a trust anchor for off-chain settlement
 * 
 * Architecture:
 * - Market lifecycle tracked on-chain (trust anchor)
 * - Value transfer happens off-chain via Yellow Network (zero gas)
 * - Settlement is verifiable via events
 * - Refunds are coordinated but executed off-chain
 */
contract YellowPredictionRegistry {
    struct Market {
        string question;
        uint256 expiresAt;
        address creator;
        bool settled;
        uint8 outcome; // 0 = unresolved, 1 = YES, 2 = NO
        uint256 createdAt;
    }

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        uint256 expiresAt,
        address indexed creator,
        uint256 createdAt
    );

    event MarketSettled(
        uint256 indexed marketId,
        uint8 outcome,
        uint256 settledAt
    );

    event MarketRefundable(
        uint256 indexed marketId,
        uint256 markedAt
    );

    /**
     * @notice Create a new prediction market
     * @param question The market question (e.g., "Will ETH hit $5000 by EOY?")
     * @param expiresAt Unix timestamp when market expires
     * @return marketId The unique ID for this market
     */
    function createMarket(
        string calldata question,
        uint256 expiresAt
    ) external returns (uint256) {
        require(expiresAt > block.timestamp, "Invalid expiry");
        require(bytes(question).length > 0, "Empty question");

        marketCount++;
        markets[marketCount] = Market({
            question: question,
            expiresAt: expiresAt,
            creator: msg.sender,
            settled: false,
            outcome: 0,
            createdAt: block.timestamp
        });

        emit MarketCreated(marketCount, question, expiresAt, msg.sender, block.timestamp);
        return marketCount;
    }

    /**
     * @notice Settle a market with the final outcome
     * @param marketId The market to settle
     * @param outcome 1 = YES wins, 2 = NO wins
     */
    function settleMarket(
        uint256 marketId,
        uint8 outcome
    ) external {
        Market storage m = markets[marketId];
        require(m.createdAt > 0, "Market does not exist");
        require(!m.settled, "Already settled");
        require(outcome == 1 || outcome == 2, "Invalid outcome");
        require(msg.sender == m.creator, "Only creator can settle");

        m.settled = true;
        m.outcome = outcome;

        emit MarketSettled(marketId, outcome, block.timestamp);
    }

    /**
     * @notice Mark an expired market as refundable
     * @param marketId The market that expired
     */
    function markRefundable(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.createdAt > 0, "Market does not exist");
        require(!m.settled, "Already settled");
        require(block.timestamp > m.expiresAt, "Not expired");

        emit MarketRefundable(marketId, block.timestamp);
    }

    /**
     * @notice Get market details
     * @param marketId The market ID
     */
    function getMarket(uint256 marketId) external view returns (
        string memory question,
        uint256 expiresAt,
        address creator,
        bool settled,
        uint8 outcome,
        uint256 createdAt
    ) {
        Market memory m = markets[marketId];
        return (
            m.question,
            m.expiresAt,
            m.creator,
            m.settled,
            m.outcome,
            m.createdAt
        );
    }

    /**
     * @notice Check if a market is expired
     * @param marketId The market ID
     */
    function isExpired(uint256 marketId) external view returns (bool) {
        return block.timestamp > markets[marketId].expiresAt;
    }

    /**
     * @notice Check if a market is settled
     * @param marketId The market ID
     */
    function isSettled(uint256 marketId) external view returns (bool) {
        return markets[marketId].settled;
    }
}
