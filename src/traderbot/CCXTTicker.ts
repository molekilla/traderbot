export interface CCXTTicker {
    symbol: string;
    info: string;
    timestamp: number;
    datetime: Date;
    high: number; // highest price
    low: number; // lowest price
    bid: number; // current best bid (buy) price
    bidVolume: number; // current best bid (buy) amount (may be missing or undefined)
    ask: number; // current best ask (sell) price
    askVolume: number; // current best ask (sell) amount (may be missing or undefined)
    vwap: number; // volume weighed average price
    open: number; // opening price
    close: number; // price of last trade (closing price for current period)
    last: number; // same as `close`, duplicated for convenience
    previousClose: number; // closing price for the previous period
    change: number; // absolute change, `last - open`
    percentage: number; // relative change, `(change/open) * 100`
    average: number; // average price, `(last + open) / 2`
    baseVolume: number; // volume of base currency traded for last 24 hours
    quoteVolume: number; // volume of quote currency traded for last 24 hours
}