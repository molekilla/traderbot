export interface BinanceOrder {
    symbol: string;
    orderId: string;
    clientOrderId: string;
    transactTime: number;
    price: number;
    origQty: number;
    executedQty: number;
    cummulativeQuoteQty: number;
    status: string;
    timeInForce: string;
    type: string;
    side: string;
}
