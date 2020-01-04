import { BigNumber } from 'bignumber.js';
import { MMMBotDB } from "../MMMBotDB";
import { Candlestick } from './Candlestick';

const ti = require('technicalindicators');
const SMA = ti.SMA;
require('dotenv').config()



export class TICalc {

    constructor(private db: MMMBotDB) {
    }

    getTIPeriodSet(key: string, periods: number[], values: number[]) {
        return periods.map(period => {
            return { [period]: ti[key].calculate({ period, values }) };
        })
    }

    getNext(key: string, periods: number[], values: number[]) {
        return periods.map(period => {
            const sma = new SMA({ period, values });
            sma.getResult();
            return { [period]: sma.nextValue(7.01) };
        })
    }
    async test() {
        const pair = 'EOSUSDT';
        const period = '1d';
        const data:  any = await this.db.getMarketData(pair, period);
        const ticks = data[0].candlesticks;


        const open: number[] = ticks.map((t: Candlestick) => new BigNumber(t.open).toNumber());
        const close: number[] = ticks.map((t: Candlestick) => new BigNumber(t.close).toNumber());

        console.log(open)
        const ti1: any = this.getNext('SMA', [7, 25, 99], open);
        const ti2: any = this.getNext('EMA', [7, 25, 99], open);
        console.log(ti1);
        console.log(ti2);
//        console.log(ti2);

    }
}

(async () => {
    const db = new MMMBotDB();
    await db.init();

    const calc = new TICalc(db);
    calc.test();

})();