import { BigNumber } from 'bignumber.js';
import { MMMBotDB, CandlestickMarketModel } from "../MMMBotDB";
import { Candlestick } from './Candlestick';

const ti = require('technicalindicators');
require('dotenv').config()



export class TechnicalIndicator {

    constructor() {
    }

    getPeriodSet(key: string, periods: number[], values: number[]) {
        return periods.map(period => {
            return { [period]: ti[key].calculate({ period, values }) };
        })
    }

    getNext(key: string, price: number, periods: number[], values: number[]) {
        let o: any = {}
        try {
            periods.forEach(period => {
                if (!price) price = 0;
                const x = new ti[key]({ period, values });
                const d = x.nextValue(1 * <any>price.toFixed(12));
                return o[period] = (1 * (d || 0).toFixed(18))
            })
        }
        catch (err) { }
        return o
    }

    // getNextAO(md: CandlestickMarketModel, price: number) {
    //     let input = {
    //         high :   md.dataset.high,
    //         low  :   md.dataset.low,
    //         fastPeriod : 5,
    //         slowPeriod : 34,
    //         format : (a: number) => parseFloat(a.toFixed(2))
    //       }
    //     let awesomeoscillator = new AwesomeOscillator(input);
    //     return awesomeoscillator.nextValue(price);
    // }
    //     async test() {
    //         const pair = 'EOSUSDT';
    //         const period = '1d';
    //         const data = await this.db.getMarketData(pair, period);
    //         const ticks = data[0].candlesticks;


    //         const open: number[] = ticks.map((t: Candlestick) => new BigNumber(t.open).toNumber());
    //         const close: number[] = ticks.map((t: Candlestick) => new BigNumber(t.close).toNumber());

    //         console.log(open)
    //         // const ti1: any = this.getNext('SMA', [7, 25, 99], open);
    //         /// const ti2: any = this.getNext('EMA', [7, 25, 99], open);
    //         console.log(ti1);
    //         console.log(ti2);
    // //        console.log(ti2);

    //     }
}

// (async () => {
//     const db = new MMMBotDB();
//     await db.init();

//     const calc = new TICalc(db);
//     calc.test();

// })();