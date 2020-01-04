import { IExchange } from "./models/IExchange";
import { BinanceOrder } from "../binance/BinanceOrder";
import { BookTicker } from "../binance/BookTicker";

import BigNumber from "bignumber.js";
import { Subject, Observable, from, interval } from "rxjs";
import { Candlestick } from "../indicators/Candlestick";
import { Position } from "./models/Position";
import { timeout } from "rxjs/operators";
import { CCXTTicker } from "./CCXTTicker";
import { CCXTOrder } from "./CCXTOrder";

const ccxt = require('ccxt')

const binance = require('node-binance-api');
require('dotenv').config()

export class CCXTExchange implements IExchange {
    tradeEvent: Observable<any>;
    _evt: Subject<any> = new Subject<any>();
    static filters: any = {};

    constructor({ name, config }: any) {
        // from variable id
        const exchangeId = name
            , exchangeClass = ccxt[exchangeId];
        this.exchange = new exchangeClass(config)
    }

    exchange: any;
    async configure() {
        await this.exchange.loadMarkets();
    }

    getBalance() {
        return this.exchange.fetchBalance();
    }

    public orderStatus(pos: Position): Promise<CCXTOrder> {
        return this.exchange.fetchOrder(pos.pendingOrderId, pos.pair);
    }

    public async candlesticks(pair: string, period: string): Promise<any[]> {
        const candlesticks = await this.exchange.fetchOHLCV(pair, period);

        return candlesticks;
    }

    public getCandlesticks() {
        return this.candlesticks;
    }


    public subscribeTrades(pairs: string[]) {

        interval(5 * 1000).subscribe(async _ => {
            for (let pair in pairs) {
                await from([1]).pipe(timeout(this.exchange.rateLimit)).toPromise();
                const trades = await this.exchange.fetchTrades(pair);
                this._evt.next(trades);
            }
        });

        this.tradeEvent = this._evt.asObservable();
        return this.tradeEvent;
    }

    /**
  * Gets price, calls binance.bookTickers
  * @param symbol 
  */
    public getPrice(symbol: string): Promise<CCXTTicker> {
        return this.exchange.fetchTicker(symbol);
    }

    public async placeOrder(pair: string, amount: number): Promise<CCXTOrder> {
        // get price
        const priceInfo = await this.getPrice(pair);
        return await this.exchange.createLimitBuyOrder(pair, amount, priceInfo.bid);
    }


    /**
     * Sell
     * @param pair eg TRXUSDT 
     * @param qty 100 
     */
    public async sellOrder(pair: string, qty: number): Promise<CCXTOrder> {
        // get price
        const priceInfo = await this.getPrice(pair);
        return await this.exchange.createLimitSellOrder(pair, qty, priceInfo.ask);
    }

}