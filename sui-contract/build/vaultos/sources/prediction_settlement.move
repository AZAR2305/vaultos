module vaultos::prediction_settlement {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;

    /// Settlement object for a resolved prediction market
    /// Each market creates one settlement object on-chain when resolved
    public struct MarketSettlement has key, store {
        id: UID,
        market_id: vector<u8>,         // Off-chain market identifier
        winning_outcome: u8,            // 1 = YES, 0 = NO
        total_pool: u64,                // Total USDC in pool (6 decimals)
        timestamp: u64,                 // Resolution timestamp
        oracle: address,                // Address that resolved the market
        settled: bool,
    }

    /// Event emitted when a market is settled on-chain
    public struct SettlementCreated has copy, drop {
        settlement_id: ID,
        market_id: vector<u8>,
        winning_outcome: u8,
        total_pool: u64,
        oracle: address,
    }

    /// Admin creates settlement after oracle resolution
    /// This function is called from the backend when a market is resolved
    public entry fun create_settlement(
        market_id: vector<u8>,
        winning_outcome: u8,
        total_pool: u64,
        ctx: &mut TxContext
    ) {
        let settlement_id = object::new(ctx);
        let id_copy = object::uid_to_inner(&settlement_id);
        let oracle = tx_context::sender(ctx);

        let settlement = MarketSettlement {
            id: settlement_id,
            market_id,
            winning_outcome,
            total_pool,
            timestamp: tx_context::epoch(ctx),
            oracle,
            settled: true,
        };

        // Emit event for indexing
        event::emit(SettlementCreated {
            settlement_id: id_copy,
            market_id: settlement.market_id,
            winning_outcome: settlement.winning_outcome,
            total_pool: settlement.total_pool,
            oracle,
        });

        // Make settlement object publicly readable
        transfer::share_object(settlement);
    }

    /// View function to check settlement details
    public fun get_settlement_info(settlement: &MarketSettlement): (vector<u8>, u8, u64, bool) {
        (
            settlement.market_id,
            settlement.winning_outcome,
            settlement.total_pool,
            settlement.settled
        )
    }

    /// Check if specific outcome won
    public fun is_outcome_winner(settlement: &MarketSettlement, outcome: u8): bool {
        settlement.settled && settlement.winning_outcome == outcome
    }
}
