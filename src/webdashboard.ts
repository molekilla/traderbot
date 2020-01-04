import { MarginBot } from './binance/MarginBot';
import { MMMBotDB } from './MMMBotDB';
import { Dashboard } from './dashboard';

// Main Loop Cancel Token
let dashboard: Dashboard;
let isStarted = false;
let binanceBot: MarginBot;

const bootInit = async () => {
    // Create Positions DB and initialize
    const positionsDb = new MMMBotDB();
    await positionsDb.init();
    binanceBot = new MarginBot(positionsDb);
    const marginPairs = process.env.MARGIN_PAIRS;

    // Sync balances and positions from database
    await binanceBot.syncBalanceAndPositions(marginPairs);

    setTimeout(() => {
        if (!isStarted) {
            dashboard = new Dashboard(positionsDb);
            dashboard.startWebServer();
            isStarted = true;
        }
    })

}
try {
    bootInit();
} catch (e) { console.log(e) }