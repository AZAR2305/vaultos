module vaultos::prediction_settlement {

    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    /// Settlement object for a resolved market
    struct MarketSettlement has key {
        id: UID,
        market_id: vector<u8>,
        winning_outcome: u8, // 1 = YES, 0 = NO
        total_pool: u64,
        settled_at: u64,
    }

    /// Admin creates settlement after oracle resolution
    public entry fun create_settlement(
        market_id: vector<u8>,
        winning_outcome: u8,
        total_pool: u64,
        ctx: &mut TxContext
    ) {
        let settlement = MarketSettlement {
            id: object::new(ctx),
            market_id,
            winning_outcome,
            total_pool,
            settled_at: tx_context::epoch(ctx),
        };

        transfer::share_object(settlement);
    }

    /// Get settlement details (for verification)
    public fun get_winning_outcome(settlement: &MarketSettlement): u8 {
        settlement.winning_outcome
    }

    public fun get_total_pool(settlement: &MarketSettlement): u64 {
        settlement.total_pool
    }
}
