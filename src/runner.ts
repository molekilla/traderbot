import { EthDexBot } from './traderbot/EthDexBot';
import { Dashboard } from './dashboard';
import { throttleTime } from 'rxjs/operators';
import { IBot } from './traderbot/models/IBot';
import { pairs } from 'rxjs';
import { BinanceExchange } from './traderbot/BinanceExchange';
import { SmaEmaScalperStrategy } from './binance/scalping';
import { BinanceBot } from './traderbot/BinanceBot';
import { CCXTExchange } from './traderbot/CCXTExchange';
import { MMMBotDB } from './MMMBotDB';

let bot: IBot;

const bootInit = async () => {
    // Create Positions DB and initialize
    const positionsDb = new MMMBotDB();
    await positionsDb.init();


    const marginPairs = process.env.MARGIN_PAIRS;
    const exchange = new CCXTExchange({
        name: 'binance',
        config: {
            'apiKey': process.env.BINANCE_ID,
            'secret': process.env.BINANCE_KEY,
            'timeout': 30000,
            'enableRateLimit': true,
        }
    });
    bot = new BinanceBot(positionsDb, exchange);
    await bot.configure({
        strategy: SmaEmaScalperStrategy,
        balances: null,
        candlesticks: null,
        pairs: marginPairs,
    });

    // bot.configure({
    //     strategy: SmaEmaScalperStrategy,
    //     balances: EthWallet.from(''),
    //     candlesticks: BinanceExchange.Candlesticks, 
    //     pairs,
    // });
    const isScalping = process.env.SCALPING_MODE;
    if (isScalping) console.log('Scalping mode');

    bot.trade();
}

try {
    bootInit();
} catch (e) { console.log(e) }

