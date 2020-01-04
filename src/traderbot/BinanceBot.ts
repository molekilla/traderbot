import { forkJoin, from, Subject, pairs, interval } from 'rxjs';
import { EventEmitter } from 'events';
import { distinct, toArray, filter, throttleTime } from 'rxjs/operators';
import { Position } from "./models/Position";
import { BookTicker } from '../binance/BookTicker';
import { BinanceOrder } from '../binance/BinanceOrder';
import { Candlestick } from '../indicators/Candlestick';
import { IStrategy } from './models/IStrategy';
import { IExchange } from './models/IExchange';
import { IDatabase } from './models/IDatabase';
import { TraderBot } from './models/TraderBot';
import { IBalances } from './models/IBalances';
import { TradingConfiguration } from './models/TradingConfiguration';
import { IBot } from './models/IBot';


export class BinanceBot extends TraderBot implements IBot {
    tradeEvent: Subject<any> = new Subject();

    private pairs: string[];
    private balancesFn: () => IBalances;
    private strategy: IStrategy;
    balances: any;
    candlesticks: any;
    private candlesticksFn: (pair: string, period: string) => Promise<any>;
    constructor(db: IDatabase,
        public exchange: IExchange) {
        super(db, exchange);
    }



    async configure(options: TradingConfiguration) {
        await this.exchange.configure();
        this.strategy = new options.strategy(this);
        this.pairs = options.pairs.split(',');
        this.candlesticksFn = options.candlesticks;
        this.balancesFn = options.balances;


        if (!options.candlesticks) {
            this.candlesticksFn = this.exchange.candlesticks.bind(this.exchange);
        }
        if (!options.balances) {
            this.balancesFn = this.exchange.getBalance.bind(this.exchange);
        }
        const balances = await this.balancesFn();
        const positions = await this.syncBalanceAndPositions(balances);
        await this.updateSymbolTechnicalIndicators(positions);
    }

    /**
     * Update symbol technical indicators
     */
    private async updateSymbolTechnicalIndicators(currentPos?: Position[]) {
        try {
            if (!currentPos) {
                currentPos = await this.db.getCurrentPositions();
            }
            // get positions from db
            const currentPairs: any[] = await from(currentPos)
                .pipe(
                    distinct(i => i.pair),
                    toArray()
                )
                .toPromise();
            const { indicators, period, keys, periods } = this.strategy.getTechnicalIndicatorConfig();
            const temp = currentPairs.map((p) => this.db.getNextValueFromCachedMarketData(
                indicators,
                p.lastPrice,
                p.pair,
                period,
                keys,
                periods
            ))

            const marketdata: any = await forkJoin(temp).toPromise();
            // get prices for positions

            const prices = currentPos
                .map((pos: Position) => this.exchange.getPrice(pos.pair));
            const posPrices = await forkJoin(prices).toPromise();
            currentPos.forEach(async (pos: Position) => {
                const ti = marketdata.find((m: any) => m.pair);
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

                    await this.db.update(pos);
                    console.log(`${pos.pair}:  ${changePerSincePurchase}`)
                }
            })
        }
        catch (error) {
            console.log(error);
        }
    }


    /**
     * Update symbol technical indicator
     */
    private async updatePositionTI(pair: string, lastPrice: number) {
        try {
            const posItems = await this.db.getCurrentPositions();
            const pos = posItems.find(i => i.pair === pair);

            const { indicators, period, keys, periods } = this.strategy.getTechnicalIndicatorConfig();
            const marketdata = await this.db.getNextValueFromCachedMarketData(
                indicators,
                pos.lastPrice,
                pair,
                period,
                keys,
                periods
            );

            const priceInfo = await this.exchange.getPrice(pair);

            const currentPrice = priceInfo.askPrice || 0;
            const changePercentage = 100 * ((currentPrice - lastPrice) / lastPrice);


            // Current change since purchase
            const changePerSincePurchase = this.changeSincePurchase(currentPrice, pos);
            pos.changePercentageSinceOrigin = changePerSincePurchase;
            pos.changePercentage = changePercentage;
            pos.lastPrice = lastPrice;
            pos.SMA = marketdata.SMA;
            pos.EMA = marketdata.EMA;
            // pos.RSI = ti.RSI;
            /// pos.AO = ti.AO;

            await this.db.update(pos);
            console.log(`${pos.pair}:  ${changePerSincePurchase}`)
        }
        catch (error) {
            console.log(error);
        }
    }


    /**
     * Syncs pairs to database
     * @param pairs eg TRXUSDT,BNBUSDT
     */
    private async syncBalanceAndPositions(balances: IBalances) {
        if (!balances) {
            console.log('No balances found');
            return;
        }
        const { period } = this.strategy.getTechnicalIndicatorConfig();
        const p = this.pairs.map(async i => {

            // get candlesticks
            const candlesticks1d: any = await this.candlesticksFn(i, period);
            // save
            await this.db.addMarketForResearch(i, candlesticks1d.candlesticks, period);

            if (balances && balances[i.replace('USDT', '')]) {
                return await this.addBalanceToPositions(`${i}`, 1 * balances[i.replace('USDT', '')].available, true);
            }
            // add qty 6, we'll update later
            return await this.addBalanceToPositions(`${i}`, 6);
        });
        await Promise.all(p);

        const currentPos = await this.db.getCurrentPositions();
        return currentPos;
    }


    /**
     * Scans position changes and executes scalper
     */
    public async scanForPositionChanges(currentBalance: number, pair: string) {
        try {
            // get positions from db
            let currentPos = await this.db.getCurrentPositions();
            let pos = currentPos.find(i => i.pair === pair);
            const price = await this.exchange.getPrice(pos.pair);
            // close if there is no balance available
            const balance: any = currentBalance;
            if (balance) {
                console.log(`Updating position ${pos.pair} with qty ${pos.qty}.`);
                pos.qty = 1 * balance;
                await this.db.update(pos);
                // const bal = parseFloat(balance) * pos.buyPrice;
                // if (bal < 5) {
                //     console.log(`Remove position ${pos.pair} with qty ${pos.qty}.`);
                //     pos.sold = true;
                //     await this.db.update(pos);
                // }
            }
            const currentPrice = price.askPrice || 0;
            const lastPrice = pos.lastPrice || pos.buyPrice;
            pos.lastPrice = currentPrice * 1;

            pos.changePercentage = 100 * ((currentPrice - lastPrice) / lastPrice);
            const changePerSincePurchase = 100 * ((currentPrice - pos.buyPrice) / pos.buyPrice);
            pos.changePercentageSinceOrigin = changePerSincePurchase;

            this.balances = await this.balancesFn();
            if (this.strategy.has(pos.pair)) {
                // Executes scalping position by pair
                pos = await this.strategy.executePair(pos.pair, pos);
            } else {
                console.log('No scalper found for ' + pos.pair);
            }
            await this.db.update(pos);
            await this.updatePendingOrder(pos);
            console.log(`${pos.pair}:  ${changePerSincePurchase}`)
        }
        catch (error) {
            console.log(error);
        }
    }


    public async updatePendingOrder(pos: Position) {
        if (pos && !pos.pendingOrderId) {
            return;
        }
        try {
            console.log(`Querying pending order ${pos.pendingOrderId}`)
            const result: any = await this.exchange.orderStatus(pos);
            if (result && result.status === 'FILLED') {
                if (result.side === 'SELL') {
                    pos.sold = true;
                    pos.sellDate = new Date(result.transactTime);
                    pos.sellPrice = result.price * 1;
                }


                await this.db.update(pos);
            }

        }
        catch (e) {
            console.log(e);
        }
    }

    public async trade() {

        this.exchange.subscribeTrades(this.pairs)
            .pipe(
                throttleTime(200)
            )
            .subscribe(async log => {
                const token = log.symbol;
                const balances = await this.balancesFn();
                const tokenBalance = balances[token.replace('USDT', '')];
                if (tokenBalance) {
                    await this.updatePositionTI(token, log.price);
                    await this.scanForPositionChanges(tokenBalance.free || tokenBalance.available, token);
                }
            });

        interval(60 * 1000).subscribe(async () => {
            const balances = await this.balancesFn();
            await this.syncBalanceAndPositions(balances);
        });

    }

    changeSincePurchase(currentPrice: number, pos: Position) {
        return 100 * ((currentPrice - pos.buyPrice) / pos.buyPrice);
    }
}

