import { MMMBotDB } from '../MMMBotDB';
import { Position } from '../traderbot/models/Position';
import { forkJoin, from, Subject } from 'rxjs';
import { EventEmitter } from 'events';
import { BinanceOrder } from './BinanceOrder';
import { BookTicker } from './BookTicker';
import { Candlestick } from '../indicators/Candlestick';
import { distinct, toArray, filter } from 'rxjs/operators';
import { TechnicalIndicator } from '../indicators/TechnicalIndicator';
import { scalpingFunctions } from './scalping';
import BigNumber from 'bignumber.js';
import { IBot } from '../traderbot/models/IBot';
import { TradingConfiguration } from '../traderbot/models/TradingConfiguration';

const binance = require('node-binance-api');
require('dotenv').config()

export interface Balances {
    [token: string]: {
        available: number;
        onOrder: number;
    }
}
export interface ExecutionInfo {
    executionType?: string;
    symbol?: string;
    price?: string;
    quantity?: number;
    side?: string;
    orderType?: string;
    orderId?: string
    orderStatus?: string;
}
export interface UserData {
    balances: Balances;
    execution: ExecutionInfo;
}

export class MarginBot implements IBot {
    trade(): void {
        throw new Error("Method not implemented.");
    }
    configure(options: TradingConfiguration): void {
        throw new Error("Method not implemented.");
    }
    tradeEvent: Subject<any> = new Subject();
    userDataEvent: Subject<any> = new Subject();
    marginUserDataEvent: Subject<any> = new Subject();
    private userData: UserData = {
        balances: {},
        execution: {}
    };
    private marginUserData: UserData = {
        balances: {},
        execution: {}
    };
    get balances() {
        return this.marginUserData.balances;
    }
    ti: TechnicalIndicator;
    onSellPosition: EventEmitter = new EventEmitter();
    static cancelToken: any;
    static cancelToken2: any;
    exchange: any;
    static filters: any = {};
    scalping: any = {};
    constructor(private positionsDb: MMMBotDB) {
        const config = {
            APIKEY: process.env.BINANCE_ID,
            APISECRET: process.env.BINANCE_KEY,
            useServerTime: true,
        };

        this.ti = new TechnicalIndicator();
        // if (process.env.IS_TEST) {
        //     config.test = true;
        // }

        this.exchange = binance().options(config);

        this.subscribeMarginUserData();
        this.subscribeUserData();
        this.scalping = scalpingFunctions(this);

        this.onSellPosition.on('SELL_ORDER_FULFILLED', async (pos: Position) => {
            if (pos.pendingOrderStatus === 'TAKE_PROFIT') {
                const savingsPair = process.env.SAVINGS_PAIR;
                const savingsPercentage = parseFloat(process.env.SAVINGS_PERCENTAGE);
                const profitPercentage = pos.takeProfitPercentage * 1;

                if ((profitPercentage > savingsPercentage) && savingsPair) {
                    const amount = savingsPercentage * (pos.sellPrice * pos.qty); // eg 4% of total
                    // get  % savings to usdc
                    await this.placeOrder(savingsPair, amount);
                }
            }
        });
    }


    /**
     * Fetches exchange info and saves into a static var
     */
    public async exchangeInfo() {
        if (Object.keys(MarginBot.filters).length > 0) return Promise.resolve();
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
                MarginBot.filters = minimums;
                //fs.writeFile("minimums.json", JSON.stringify(minimums, null, 4), function(err){});
                resolve();
            });
        });
    }

    /**
     * Update symbol technical indicators
     */
    public async updateSymbolTechnicalIndicators(currentPos?: Position[]) {
        try {
            if (!currentPos) {
                currentPos = await this.positionsDb.getCurrentPositions();
            }
            const reindex = (t: any) => {
                if (t === 'BCHABCUSDT') return 'BCCUSDT';
                return t;
            };
            // get positions from db
            const currentPairs: any[] = await from(currentPos)
                .pipe(
                    distinct(i => i.pair),
                    toArray()
                )
                .toPromise();
            const temp = currentPairs.map((p) => this.positionsDb.getNextValueFromCachedMarketData(
                this.ti,
                p.lastPrice,
                p.pair,
                '1d',
                ['EMA', 'SMA'],
                [7, 25]
            ))

            const marketdata: any = await forkJoin(temp).toPromise();
            // get prices for positions
            const prices = currentPos
                .map((pos: Position) => this.getPrice(pos.pair));
            const posPrices = await forkJoin(prices).toPromise();
            currentPos.forEach(async (pos: Position) => {
                const ti = marketdata.find((m: any) => m.pair === reindex(pos.pair));
                if (ti) {
                    const tickerInfo: BookTicker = posPrices
                        .find((i: BookTicker) => i.symbol === pos.pair) || {};

                    const currentPrice = tickerInfo.askPrice || 0;
                    const lastPrice = pos.lastPrice || pos.buyPrice;
                    pos.lastPrice = currentPrice * 1;
                    pos.changePercentage = 100 * ((currentPrice - lastPrice) / lastPrice);

                    // Current change since purchase
                    const changePerSincePurchase = this.changeSincePurchase(currentPrice, pos);
                    pos.changePercentageSinceOrigin = changePerSincePurchase;

                    pos.SMA = ti.SMA;
                    pos.EMA = ti.EMA;
                    // pos.RSI = ti.RSI;
                    /// pos.AO = ti.AO;

                    await this.positionsDb.update(pos);
                    console.log(`${pos.pair}:  ${changePerSincePurchase}`)
                }
            })
        }
        catch (error) {
            console.log(error);
        }

        //}, TIMEOUT);
    }

    private async addBalanceToPositions(pair: string, qty: number, update: boolean = false) {
        console.log(`add pair ${pair}`)
        // find by pair
        const found = await this.positionsDb.findByPair(pair);
        if (found) {
            console.log(`Pair ${pair} already in DB`);
            return;
        }
        const price = await this.getPrice(pair);
        // console.log(`price ${price.askPrice} ${price.error}`)
        if (price.error) return;
        const position = Position.createFromBalance(pair, qty, price.askPrice);
        //   console.log(position)
        await this.positionsDb.add(position);
        // console.log(`Place position: ${order.symbol} BUY ${order.origQty}@${order.price} - ${position.id}`);
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
    /**
     * Syncs pairs to database
     * @param pairs eg TRXUSDT,BNBUSDT
     */
    public async syncBalanceAndPositions(pairs: string) {
        const balances = await this.loadMarginBalances();
        if (!balances) {
            console.log('No balances found');
            return;
        }
        this.marginUserData.balances = balances;

        const tokens = pairs.split(',');
        const p = tokens.map(async i => {

            // get candlesticks
            const candlesticks1d: any = await this.candlesticks(i, '1d');
            // save
            await this.positionsDb.addMarketForResearch(i, candlesticks1d.candlesticks, '1d');

            if (balances && balances[i.replace('USDT', '')]) {
                return await this.addBalanceToPositions(`${i}`, 1 * balances[i.replace('USDT', '')].available, true);
            }
            // add qty 6, we'll update later
            return await this.addBalanceToPositions(`${i}`, 6);
        });
        await Promise.all(p);

        const currentPos = await this.positionsDb.getCurrentPositions();
        return currentPos;
    }

    private async loadMarginBalances(): Promise<Balances> {
        return await this.positionsDb.loadMarginBalances();
    }

    /**
     * Scans position changes and executes scalper
     */
    public async scanForPositionChanges(currentBalance: number, pair: string) {
        try {
            // get positions from db
            let currentPos = await this.positionsDb.getCurrentPositions();
            let pos = currentPos.find(i => i.pair === pair);
            const price = await this.getPrice(pos.pair);
            // close if there is no balance available
            const balance: any = currentBalance;
            if (balance) {
                console.log(`Updating position ${pos.pair} with qty ${pos.qty}.`);
                pos.qty = 1 * balance;
                await this.positionsDb.update(pos);
                // const bal = parseFloat(balance) * pos.buyPrice;
                // if (bal < 5) {
                //     console.log(`Remove position ${pos.pair} with qty ${pos.qty}.`);
                //     pos.sold = true;
                //     await this.positionsDb.update(pos);
                // }
            }
            const currentPrice = price.askPrice || 0;
            const lastPrice = pos.lastPrice || pos.buyPrice;
            pos.lastPrice = currentPrice * 1;

            pos.changePercentage = 100 * ((currentPrice - lastPrice) / lastPrice);
            const changePerSincePurchase = 100 * ((currentPrice - pos.buyPrice) / pos.buyPrice);
            pos.changePercentageSinceOrigin = changePerSincePurchase;

            if (this.scalping[pos.pair]) {
                // Executes scalping position by pair
                pos = await this.scalping[pos.pair](pos);
            } else {
                console.log('No scalper found for ' + pos.pair);
            }
            await this.positionsDb.update(pos);
            await this.updatePendingOrder(pos);
            console.log(`${pos.pair}:  ${changePerSincePurchase}`)
        }
        catch (error) {
            console.log(error);
        }
    }


    /**
     * Subscribes to exchange balances
     */
    public subscribeUserData() {
        this.exchange.websockets.userData((data: any) => {
            // balance update
            for (let obj of data.B) {
                let { a: asset, f: available, l: onOrder } = obj;
                if (available == "0.00000000") continue;
                this.userData.balances[asset] = {
                    available,
                    onOrder,
                };
            }
            this.userDataEvent.next(this.userData);

        }, (data: any) => {
            // execution update
            console.log(data);
        });
    }

    /**
     * Subscribes to margin balances
     */
    public subscribeMarginUserData() {
        this.exchange.websockets.userMarginData(async (data: any) => {
            // balance update
            for (let obj of data.B) {
                let { a: asset, f: available, l: onOrder } = obj;
                // if (available === "0.00000000") continue;
                this.marginUserData.balances[asset] = {
                    available,
                    onOrder,
                };
            }
            this.marginUserDataEvent.next(this.marginUserData);
            await this.positionsDb.saveMarginBalances(this.marginUserData.balances);
        }, (data: any) => {
            // execution update
            // console.log(data);
        });
    }

    public subscribeTrades(pairs: string[]) {
        this.exchange.websockets.trades(pairs, (trades: any) => {
            let { e: eventType, E: eventTime, s: symbol, p: price, q: quantity, m: maker, a: tradeId } = trades;
            console.log(symbol + " trade update. price: " + price + ", quantity: " + quantity + ", maker: " + maker);
            let obj = { eventType, eventTime, symbol, price, quantity, maker }
            obj = Object.assign({}, obj, this.marginUserData.balances)
            this.tradeEvent.next(obj);
        });
    }

    public async placeOrder(pair: string, amount: number): Promise<BinanceOrder> {
        // get price
        const priceInfo: BookTicker = await this.getPrice(pair);

        const price = this.exchange.roundTicks(
            priceInfo.bidPrice,
            MarginBot.filters[pair].tickSize
        );

        // calc qty
        let qty = amount / price;

        // Round to stepSize
        qty = this.exchange.roundStep(qty, MarginBot.filters[pair].stepSize);
        console.log(`${pair} ${qty} ${MarginBot.filters[pair].stepSize} ${MarginBot.filters[pair].minNotional}`)

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

        await this.positionsDb.addAccounting(pair, qty, price, 'buy');

        return response;

    }

    public async updatePendingOrder(pos: Position) {
        if (pos && !pos.pendingOrderId) {
            return;
        }
        try {
            console.log(`Querying pending order ${pos.pendingOrderId}`)
            const result: any = await new Promise((resolve: any, reject: any) => {
                this.exchange.mgOrderStatus(pos.pair, pos.pendingOrderId, (err: any, order: any) => {
                    if (err) return reject(err.code);
                    return resolve(order);
                });
            });

            if (result && result.status === 'FILLED') {
                if (result.side === 'SELL') {
                    pos.sold = true;
                    pos.sellDate = new Date(result.transactTime);
                    pos.sellPrice = result.price * 1;
                }


                await this.positionsDb.update(pos);
            }

            this.onSellPosition.emit('SELL_ORDER_FULFILLED', pos);
        }
        catch (e) {
            console.log(e);
        }
    }

    /**
     * Cancel all stranded margin buy orders
     */
    public async cancelStrandedBuyOrders() {
        try {
            const result: BinanceOrder[] = await new Promise((resolve: any, reject: any) => {
                this.exchange.openOrders(false, (err: any, order: any) => {
                    if (err) return reject(err.code);
                    return resolve(order);
                });
            });

            const positions: Position[] = await this.positionsDb.getCurrentPositions();
            let mapped: any = {}
            positions.forEach(i => {
                mapped = {
                    [i.id]: i,
                    ...mapped,
                }
            })


            const items = result.filter(i => mapped[i.orderId] && i.side === 'BUY');

            items.forEach(async (i: BinanceOrder) => {
                await this.cancelOrder(i);
                await this.positionsDb.remove(i.orderId);
            })
        }
        catch (e) {
            console.log(e);
        }
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

    /**
     * Margin sell
     * @param pair eg TRXUSDT 
     * @param qty 100
     * @param sellLess if sell less than the actual amount 
     */
    public async sellOrder(pair: string, qty: number, sellLess: boolean): Promise<BinanceOrder> {
        // get price
        const priceInfo: BookTicker = await this.getPrice(pair);

        const price = this.exchange.roundTicks(
            priceInfo.askPrice,
            MarginBot.filters[pair].tickSize
        );
        if (sellLess) {
            qty = qty * (0.99);
        }

        qty = new BigNumber(qty).toNumber();


        // Round to stepSize
        qty = this.exchange.roundStep(qty, MarginBot.filters[pair].stepSize);


        const order: Promise<BinanceOrder> = new Promise(async (resolve, reject) => {
            this.exchange.mgSell(pair, qty, price, {},
                (error: any, response: any) => {
                    if (error) return reject(error.body);
                    resolve(response);
                });
        });

        const response: BinanceOrder = await order;

        await this.positionsDb.addAccounting(pair, qty, price, 'sell');

        return response;
    }

    public async cancelOrder(pos: BinanceOrder): Promise<any> {
        return new Promise(async (resolve, reject) => {
            this.exchange.mgCancel(pos.symbol, pos.orderId,
                (error: any, response: any) => {
                    if (error) return reject(error.body);
                    resolve(response);
                });
        });
    }

    public async withdraw() {

    }


    changeSincePurchase(currentPrice: number, pos: Position) {
        return 100 * ((currentPrice - pos.buyPrice) / pos.buyPrice);
    }
}

