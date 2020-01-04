import { MMMBot } from "../MMMBot";
import { Position } from '../../traderbot/models/Position';
import moment, { Moment, MomentObjectOutput } from 'moment';
import { EventEmitter } from "events";
import { IBot } from "../../traderbot/models/IBot";

const changeCalc = (value: number, lastPrice: number) => (-value + lastPrice) / lastPrice;
export interface ConsolidatedTechnicalIndicator {
    AOtrend: false,
    high: number,
    low: number,
    changeLow: number,
    changeHigh: number,
    trend: boolean,
    isSMA: boolean,
    isEMA: boolean,
    canBuy: boolean,
    canSell: boolean,
    change: number,
    changeSinceLastOrder: number;
}
const metrics = (buyPrice: number, lastPrice: number, ti: Position, scalpingOptions: ScalperOptions): ConsolidatedTechnicalIndicator => {
    if (!ti.SMA) return null;
    const model: ConsolidatedTechnicalIndicator = {
        AOtrend: false,
        high: ti.SMA.high['7'],
        low: ti.SMA.low['7'],
        changeLow: changeCalc(ti.SMA.low['7'], lastPrice),
        changeHigh: changeCalc(ti.SMA.high['7'], lastPrice),
        trend: false,
        isSMA: false,
        isEMA: false,
        canBuy: false,
        canSell: false,
        change: 0,
        changeSinceLastOrder: changeCalc(buyPrice, lastPrice),
    }

    
    // trend
    const change = (changeCalc(ti.SMA.close['7'], lastPrice) + changeCalc(ti.EMA.close['7'], lastPrice)) / 2;
    let trend = change > 0;

    const isSMA = (ti.SMA.close['7'] > lastPrice) && (ti.SMA.open['7'] >= lastPrice);
    const isEMA = (ti.EMA.close['7'] > lastPrice) && (ti.EMA.open['7'] >= lastPrice);
    model.trend = trend;
    model.change = change;
    model.isEMA = isEMA;
    model.isSMA = isSMA;    
    model.canBuy = trend && isEMA && isSMA && model.changeSinceLastOrder < -scalpingOptions.changePerc;
    model.canSell = !trend && isEMA && isSMA && model.changeSinceLastOrder > scalpingOptions.changePerc;

    if (!scalpingOptions.followMAOpenCloseTrend){
        trend = true;
    }
    if (!model.canSell && trend 
    && model.changeSinceLastOrder > scalpingOptions.changePerc && (scalpingOptions.sellPriceDiff * lastPrice) > lastPrice) {
        model.canSell = true;
    }
    if (!model.canBuy && trend 
    && model.changeSinceLastOrder < -scalpingOptions.changePerc && (scalpingOptions.buyPriceDiff * lastPrice) < lastPrice ) {
        model.canBuy = true;
    }

    // if (ti.lastAO === null) {
    //     model.AOtrend = (ti.lastAO < 0) && (ti.AO > 0);  // buy
    // } else {
    //     ti.lastAO = ti.AO;
    // }
    // console.log(model)
    return model;
}

export interface ScalperOptions {
    onBuy?: (...args: []) => void;
    onSell?: (...args: []) => void;
    savings?: {
        stablecoin: string;
        amount: number;
    },
    followMAOpenCloseTrend?: boolean;
    buyPriceDiff?: number;
    sellPriceDiff?: number;
    qty: number;
    reserved?: number;
    changePerc?: number;
}

export class Scalper {
    static onTrade: EventEmitter = new EventEmitter();
    qty = 0;
    lastExecution: Moment;

    constructor(private bot: IBot, private tokenName: string,  private options: ScalperOptions = {
            buyPriceDiff: 1,
            sellPriceDiff: 1,
            qty: 1,
            reserved: 0,
            changePerc: 1.02,
            followMAOpenCloseTrend: true,
        }, private baseToken: string = 'USDT',) {
        this.qty = options.qty;
        if (options.onBuy)  
            Scalper.onTrade.addListener(`BUY_${tokenName}`, options.onBuy);
        if (options.onSell)
            Scalper.onTrade.addListener(`SELL_${tokenName}`, options.onSell);
    }

    async scalper(pos: Position): Promise<Position> {
        console.log(`entered ${this.tokenName} scalping`)
        const now: Moment = moment();
        if (pos.scalpingPrice===null || pos.scalpingPrice === undefined) {
            pos.scalpingPrice = pos.lastPrice;
            pos.buyPrice = pos.lastPrice;
        } 
        if (pos.lastExecution) {
            this.lastExecution = moment(pos.lastExecution);
        } else {
            this.lastExecution = now;
            pos.lastExecution = now.toDate();
        }
        if (now.diff(this.lastExecution, 'seconds') < (60 * 9)) {
            // skip, circuit breaker 
            console.log('circuit breaker activated, 9 minutes rest');
            return pos;
        }
        if (!pos.canScalpingNext) {
            pos.canScalpingNext = true;
            console.log(`scalping schedule for ${this.tokenName}`);
            return pos;
        }

        pos.isCooldown = false;
        const diff = (pos.lastPrice - pos.scalpingPrice) / pos.scalpingPrice;
        console.log(`scalping diff ${this.tokenName}${this.baseToken} - ${diff}`);
        const balances: any = this.bot.balances;
        const balance = balances[this.tokenName].available;
        const balanceUSDT = balances[this.baseToken].available;

        let amount = this.qty * pos.lastPrice;

        const model = metrics(pos.scalpingPrice, pos.lastPrice, pos, this.options);
        if (!model) return pos;
        pos.metrics = model;

        const newqty = (parseFloat(balance)-this.qty);

        if (newqty >= this.options.reserved && parseFloat(balance) > this.qty && model.canSell) {
            // sell
            await this.bot.sellOrder(`${this.tokenName}${this.baseToken}`, this.qty, false);
            console.log(`scalping SELL ${this.qty} ${this.tokenName} for ${pos.lastPrice}`);
            pos.canScalpingNext = false;
            this.lastExecution = moment();
            pos.lastExecution = this.lastExecution.toDate();
            pos.scalpingPrice = pos.lastPrice
            pos.isCooldown = true;

            Scalper.onTrade.emit(`SELL_${this.tokenName}`, {
                token: this.tokenName,            
            });
        }
        if (parseFloat(balanceUSDT) > amount && model.canBuy) {
            // buy
            await this.bot.placeOrder(`${this.tokenName}${this.baseToken}`, amount);
            console.log(`scalping BUY ${this.qty} ${this.tokenName} for ${pos.lastPrice}`);
            pos.canScalpingNext = false;
            this.lastExecution = moment();
            pos.lastExecution = this.lastExecution.toDate();
            pos.scalpingPrice = pos.lastPrice;
            pos.isCooldown = true;

            Scalper.onTrade.emit(`BUY_${this.tokenName}`, {
                token: this.tokenName,            
            });
        }

        if (newqty >= this.options.reserved && this.options.savings && parseFloat(balanceUSDT) > this.options.savings.amount && model.canSell) {
            await this.bot.placeOrder(`${this.options.savings.stablecoin}${this.baseToken}`, this.options.savings.amount);
            console.log(`savings BUY ${this.options.savings.amount} ${this.options.savings.stablecoin}`);
        }
        return pos;
    };
}
// ${this.tokenName} scalping   
