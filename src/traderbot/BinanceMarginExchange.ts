import { IExchange } from "./models/IExchange";
import { BinanceOrder } from "../binance/BinanceOrder";
import { BookTicker } from "../binance/BookTicker";

import BigNumber from "bignumber.js";
import { Subject, Observable } from "rxjs";
import { Candlestick } from "../indicators/Candlestick";
import { Position } from "./models/Position";

const ccxt = require('ccxt')

const binance = require('node-binance-api');
require('dotenv').config()


class BinanceBalances {
    private exchange: any;
    constructor() {

        // from variable id
        const exchangeId = 'binance'
            , exchangeClass = ccxt[exchangeId];
        this.exchange = new exchangeClass({
            'apiKey': process.env.BINANCE_ID,
            'secret': process.env.BINANCE_KEY,
            'timeout': 30000,
            'enableRateLimit': true,
        })
    }

    getBalance() {
        return this.exchange.fetchBalance();
    }
}

export class BinanceExchange implements IExchange {
    tradeEvent: Observable<any>;
    _evt: Subject<any> = new Subject<any>();
    static filters: any = {};

    public async orderStatus(pos: Position) {
        return await new Promise((resolve: any, reject: any) => {
            this.exchange.mgOrderStatus(pos.pair, pos.pendingOrderId, (err: any, order: any) => {
                if (err) return reject(err.code);
                return resolve(order);
            });
        });


    }
    public async candlesticks(pair: string, period: string): Promise<any[]> {
        return new Promise((resolve: any, reject: any) => {
            this.exchange.candlesticks(pair, period, (e: any, t: any) => {
                if (e) return resolve([]);
                const data = t.map((i: any) => {
                    let [time, open, high, low, close, volume, closeTime] = i;
                    const candle = { open, high, low, close, volume } as Candlestick;
                    let y = new Date();
                    y.setTime(time);
                    let c = new Date();
                    c.setTime(closeTime);
                    candle.time = y;
                    candle.closeTime = c;
                    return candle;
                })
                return resolve({ pair, period, candlesticks: data });
            }, { limit: 30 });
        });
    }


    static getMarginBalance() {
        const e = new BinanceBalances();
        return e.getBalance();
    }
    public subscribeTrades(pairs: string[]) {
        this.exchange.websockets.trades(pairs, (trades: any) => {
            let { e: eventType, E: eventTime, s: symbol, p: price, q: quantity, m: maker, a: tradeId } = trades;
            console.log(symbol + " trade update. price: " + price + ", quantity: " + quantity + ", maker: " + maker);
            let obj = { eventType, eventTime, symbol, price, quantity, maker }
            // obj = Object.assign({}, obj, this.marginUserData.balances)
            this._evt.next(obj);
        });

        this.tradeEvent = this._evt.asObservable();
        return this.tradeEvent;
    }

    /**
  * Gets price, calls binance.bookTickers
  * @param symbol 
  */
    public getPrice(symbol: string): Promise<BookTicker> {
        return new Promise((resolve, reject) => {
            this.exchange.bookTickers(symbol.toUpperCase(),
                (error: any, ticker: any) => {
                    if (error) {
                        resolve({ error: 'NOT_FOUND' });
                        console.log(error.code, symbol);
                        return;
                    }
                    resolve(ticker);
                    return;
                });
        });
    }

    public async placeOrder(pair: string, amount: number): Promise<BinanceOrder> {
        // get price
        const priceInfo: BookTicker = await this.getPrice(pair);

        const price = this.exchange.roundTicks(
            priceInfo.bidPrice,
            BinanceExchange.filters[pair].tickSize
        );

        // calc qty
        let qty = amount / price;

        // Round to stepSize
        qty = this.exchange.roundStep(qty, BinanceExchange.filters[pair].stepSize);
        console.log(`${pair} ${qty} ${BinanceExchange.filters[pair].stepSize} ${BinanceExchange.filters[pair].minNotional}`)

        // price

        // DEMO:
        // const resp = {
        //     "symbol": pair,
        //     "orderId": 28,
        //     "clientOrderId": "6gCrw2kRUAF9CvJDGP16IP",
        //     "transactTime": (new Date()).getTime(),
        //     "price": price,
        //     "origQty": qty,
        //     "executedQty": qty,
        //     "cummulativeQuoteQty": qty,
        //     "status": "FILLED",
        //     "timeInForce": "GTC",
        //     "type": "MARKET",
        //     "side": "SELL"
        // };
        const p: Promise<BinanceOrder> = new Promise(async (resolve, reject) => {
            this.exchange.mgBuy(pair, qty, price, { type: 'LIMIT', newOrderRespType: 'FULL' },
                (error: any, response: any) => {
                    if (error) return reject(error.body);
                    resolve(response);
                });
        });

        const response: BinanceOrder = await p;


        return response;

    }


    /**
     * Margin sell
     * @param pair eg TRXUSDT 
     * @param qty 100
     * @param sellLess if sell less than the actual amount 
     */
    public async sellOrder(pair: string, qty: number): Promise<BinanceOrder> {
        // get price
        const priceInfo: BookTicker = await this.getPrice(pair);

        const price = this.exchange.roundTicks(
            priceInfo.askPrice,
            BinanceExchange.filters[pair].tickSize
        );

        qty = new BigNumber(qty).toNumber();


        // Round to stepSize
        qty = this.exchange.roundStep(qty, BinanceExchange.filters[pair].stepSize);


        const order: Promise<BinanceOrder> = new Promise(async (resolve, reject) => {
            this.exchange.mgSell(pair, qty, price, {},
                (error: any, response: any) => {
                    if (error) return reject(error.body);
                    resolve(response);
                });
        });

        const response: BinanceOrder = await order;


        return response;
    }

    exchange: any;
    async configure() {

        const config = {
            APIKEY: process.env.BINANCE_ID,
            APISECRET: process.env.BINANCE_KEY,
            useServerTime: true,
        };
        this.exchange = binance().options(config);
        await this.exchangeInfo();
    }

    /**
 * Fetches exchange info and saves into a static var
 */
    private async exchangeInfo() {
        if (Object.keys(BinanceExchange.filters).length > 0) return Promise.resolve();
        return new Promise((resolve, reject) => {
            this.exchange.exchangeInfo((error: any, data: any) => {
                let minimums: any = {};
                for (let obj of data.symbols) {
                    let filters: any = { status: obj.status };
                    for (let filter of <any>obj.filters) {
                        if (filter.filterType == "MIN_NOTIONAL") {
                            filters.minNotional = filter.minNotional;
                        } else if (filter.filterType == "PRICE_FILTER") {
                            filters.minPrice = filter.minPrice;
                            filters.maxPrice = filter.maxPrice;
                            filters.tickSize = filter.tickSize;
                        } else if (filter.filterType == "LOT_SIZE") {
                            filters.stepSize = filter.stepSize;
                            filters.minQty = filter.minQty;
                            filters.maxQty = filter.maxQty;
                        }
                    }
                    //filters.baseAssetPrecision = obj.baseAssetPrecision;
                    //filters.quoteAssetPrecision = obj.quoteAssetPrecision;
                    filters.orderTypes = obj.orderTypes;
                    filters.icebergAllowed = obj.icebergAllowed;
                    minimums[obj.symbol] = filters;
                }
                BinanceExchange.filters = minimums;
                //fs.writeFile("minimums.json", JSON.stringify(minimums, null, 4), function(err){});
                resolve();
            });
        });
    }

}