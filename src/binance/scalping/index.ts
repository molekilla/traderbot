import { Position } from '../../traderbot/models/Position';
import { Scalper, ScalperOptions } from './GenericScalper';
import { IBot } from '../../traderbot/models/IBot';
import { IStrategy } from '../../traderbot/models/IStrategy';
import { TechnicalIndicator } from '../../indicators/TechnicalIndicator';

let SCALPER_FUNCTIONS: any = {};
export function addScalperFunction(bot: IBot, pair: string, symbol: string, config: ScalperOptions) {
    const instance = new Scalper(bot, symbol, config);
    SCALPER_FUNCTIONS = {
        ...SCALPER_FUNCTIONS,
        [pair]: (position: Position) => instance.scalper(position),
    }
}

export const scalpingFunctions = (bot: IBot) => {
    addScalperFunction(bot, 'VETUSDT', 'VET', {
        qty: 3000,
        changePerc: 0.5,
        buyPriceDiff: 0.9,
        sellPriceDiff: 1.2,
        reserved: 31
    });
    addScalperFunction(bot, 'XTZUSDT', 'XTZ', {
        qty: 15,
        changePerc: 0.5,
        buyPriceDiff: 0.90,
        sellPriceDiff: 1.25,
        reserved: 2
    });
    addScalperFunction(bot, 'ATOMUSDT', 'ATOM', {
        qty: 5,
        changePerc: 0.25,
        buyPriceDiff: 0.90,
        sellPriceDiff: 1.25,
        reserved: 10
    });    
    addScalperFunction(bot, 'RVNUSDT', 'RVN', {
        qty: 500, 
        buyPriceDiff: 0.9, 
        sellPriceDiff: 1.2,
        changePerc: 0.25,
        reserved: 100
    });
    addScalperFunction(bot, 'BTTUSDT', 'BTT', {
        qty: 1_070_000, 
        changePerc: 0.0045,
        buyPriceDiff: 0.79, 
        sellPriceDiff: 1.45,
        reserved: 10_000,
    });
    addScalperFunction(bot, 'ONTUSDT', 'ONT', {
        qty: 25, 
        changePerc: 0.2,
        buyPriceDiff: 0.90, 
        sellPriceDiff: 1.2
    });
    addScalperFunction(bot, 'IOSTUSDT', 'IOST', {
        qty: 3_011, 
        changePerc: 0.019,
        buyPriceDiff: 0.85, 
        sellPriceDiff: 1.25,
        // reserved: 4000,
    });
    addScalperFunction(bot, 'BTCUSDT', 'BTC', {
        qty: 0.01, 
        changePerc: 0.009,
        buyPriceDiff: 0.60, 
        sellPriceDiff: 1.75,
        // reserved: 0.03,
        // savings: {
        //     stablecoin: 'USDC',
        //     amount: 15,
        // }
    });
    addScalperFunction(bot, 'MATICUSDT', 'MATIC', {
        qty: 500, 
        changePerc: 0.1,
        buyPriceDiff: 0.90, 
        sellPriceDiff: 1.35,
        // reserved: 1000
    });
    addScalperFunction(bot, 'ALGOUSDT', 'ALGO', {
        qty: 75, 
        changePerc: 0.019,
        buyPriceDiff: 0.90, 
        sellPriceDiff: 1.35,
        reserved: 25
    });    
    addScalperFunction(bot, 'NULSUSDT', 'NULS', {
        qty: 175, 
        changePerc: 0.02,
        buyPriceDiff: 0.9,
        sellPriceDiff: 1.25,
        reserved: 150,
    });
    // addScalperFunction(bot, 'ADA', { qty: 400 });

    return SCALPER_FUNCTIONS;
}

export class SmaEmaScalperStrategy implements IStrategy {
    ti: TechnicalIndicator = new TechnicalIndicator();
    scalpers:  any;
    has(pair: string): Boolean {
        return !!this.scalpers[pair];
    }
    getTechnicalIndicatorConfig(): any {
        return {
            period: '4h',
            periods: [7, 25],
            keys: ['SMA', 'EMA'],
            indicators: new TechnicalIndicator(),

        }
    }
    constructor(private bot: IBot) {
        this.scalpers = scalpingFunctions(bot);
    }
    executePair(pair: string, position: Position) {
        return this.scalpers[pair](position);
    }
}