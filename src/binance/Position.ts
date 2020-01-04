import { BinanceOrder } from "./BinanceOrder";
import { ConsolidatedTechnicalIndicator } from "./scalping/GenericScalper";

export class Position {
    paperTrade = false;
    id: string = '';
    _id = '';
    pair: string = '';
    amount = 0;
    qty = 0;
    buyPrice = 0;
    buyDate!: Date;
    sellPrice = 0;
    sellDate!: Date;;
    stopLossPercentage!: number;
    takeProfitPercentage!: number;
    currentPrice!: number;
    lastPrice!: number;
    scalpingPrice: number;
    SMA: any;
    EMA: any;
    RSI: any;
    AO: number;
    lastAO: number;
    scalpingDiff: number;

    canScalpingNext: boolean;
    lastExecution: Date;
    changePercentage!: number;
    changePercentageSinceOrigin!: number;
    sold: boolean = false;
    pendingOrderId: string;
    pendingOrderStatus: 'STOP_LOSS' | 'TAKE_PROFIT' | 'BUY';
    metrics: ConsolidatedTechnicalIndicator;
    isCooldown: boolean = false;
    constructor() { }

    static createFromBinanceOrder(order: BinanceOrder, stopLoss: any, takeProfit: any) {
        const position = new Position();
        position.pair = order.symbol;
        position.amount = order.executedQty * order.price;
        position.buyDate = new Date(order.transactTime);
        position.buyPrice = order.price * 1;
        position.stopLossPercentage = stopLoss;
        position.takeProfitPercentage = takeProfit;
        position.qty = order.origQty * 1;
        position.id = order.orderId;
        position.pendingOrderStatus = 'BUY';

        return position;
    }
    static createFromBalance(pair: string, qty: number, price: number) {
        const position = new Position();
        position.pair = pair;
        position.amount = qty * price;
        position.buyDate = new Date();
        position.buyPrice = price * 1;
        position.stopLossPercentage = null;
        position.takeProfitPercentage = null;
        position.qty = qty;
        position.id = pair+qty;
        //position.id = order.orderId;
        //position.pendingOrderStatus = 'BUY';

        return position;
    }
}