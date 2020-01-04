import { forkJoin, from } from 'rxjs';
import { MMMBotDB } from '../MMMBotDB';
import { async } from 'rxjs/internal/scheduler/async';
import { Markets } from '../tradingview/Markets';
import { MMMBot } from '../binance/MMMBot';
import { BookTicker } from '../binance/BookTicker';
import { TechnicalIndicator } from './TechnicalIndicator';
import { throttleTime, toArray, switchMap } from 'rxjs/operators';


// Main Loop Cancel Token
let idleSchedulerToken: NodeJS.Timeout;
const markets = new Markets();
let isStarted = false;
const ti = new TechnicalIndicator();

const bootInit = async () => {
    // Create Positions DB and initialize
    const db = new MMMBotDB();
    await db.init();

    // Create MMMBot and inject positions DB
    const binanceBot = new MMMBot(db);

    // Fetch Exchange Info, required to get price step sizes
    // await binanceBot.exchangeInfo();

    // Fecth Recommended MA
    let tickers = []; // await markets.fetchRecommendMA({ filterExchange: 'BINANCE' });
    // const balances: any = await binanceBot.getBalances();
    // Object.keys(balances).forEach(ticker => {
    //     if (parseFloat(balances[ticker]) > 10) {
    //         if (ticker === 'FET') {
    //             tickers = [...tickers, `${ticker}BTC`];
    //         } else {
    //             tickers = [...tickers, `${ticker}USDT`];
    //         }
    //     }
    // });
    tickers.push(`MATICUSDT`);
    tickers.push(`TRXUSDT`);
    tickers.push(`ALGOUSDT`);
    const tickerPrices: Promise<BookTicker>[] = tickers.map((item: any) => binanceBot.getPrice(item));
    const maItems = await from(tickerPrices).pipe(switchMap(i => i), throttleTime(1250), toArray()).toPromise();
    // console.log(maItems)
    let recommendedMAItems = maItems.filter((item: BookTicker) => !item.error);
    // recommendedMAItems = [...recommendedMAItems, { symbol: 'BTTUSDT' }]
    console.log('Adding tickers', recommendedMAItems);

    // get candlesticks
    const candlesticks1d = recommendedMAItems.map((t: BookTicker) => binanceBot.candlesticks(t.symbol, '1d'));
    const items = await forkJoin(candlesticks1d).toPromise();

    // save
    const x = items.map((i: any) => db.addMarketForResearch(i.pair, i.candlesticks, i.period));

    await forkJoin(x).toPromise();

    const temp = recommendedMAItems.map((p) => {
        try {
            db.getNextValueFromCachedMarketData(
                ti,
                p.askPrice,
                p.symbol,
                '1d',
                ['EMA', 'SMA', 'RSI'],
                [7, 25]
            );
        }
        catch (e) { }
    });
    // const marketdata: any = await forkJoin(temp).toPromise();


    // const nextPeriod = (ind: any, type: string) => {
    //     return [
    //         ind[type][0],
    //         ind[type][1],
    //         ind[type][2]
    //     ]
    // }


    if (idleSchedulerToken) {
        clearTimeout(idleSchedulerToken);
    }

    idleSchedulerToken = setTimeout(
        bootInit,
        10 * 1000,
    );
    // start idle position scheduler
    console.log(`research job, rescheduling`);
}

try {
    bootInit();
} catch (e) { console.log(e) }

