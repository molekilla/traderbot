export interface CCXTOrder {
    'id': string; // string
    'datetime': Date; // ISO8601 datetime of 'timestamp' with milliseconds
    'timestamp': number; // order placing/opening Unix timestamp in milliseconds
    'lastTradeTimestamp': number; // Unix timestamp of the most recent trade on this order
    'status': 'open' | 'closed' | 'canceled';         // 'open', 'closed', 'canceled'
    'symbol': string;      // symbol
    'type': 'limit' | 'market';        // 'market', 'limit'
    'side': 'buy' | 'sell';          // 'buy', 'sell'
    'price': number;    // float price in quote currency
    'amount': number;           // ordered amount of base currency
    'filled': number;           // filled amount of base currency
    'remaining': number;           // remaining amount to fill
    'cost': number;   // 'filled' * 'price' (filling price used where available)
    'trades': any[];         // a list of order trades/executions
    'fee': {                      // fee info, if available
        'currency': string;        // which currency the fee is (usually quote)
        'cost': number;           // the fee amount in that currency
        'rate': number;            // the fee rate (if available)
    },
    'info': string;              // the original unparsed order structure as is
}