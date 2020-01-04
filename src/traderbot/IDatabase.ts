import { Position } from "./Position";
import { TechnicalIndicator } from "../indicators/TechnicalIndicator";
import { Candlestick } from "../indicators/Candlestick";

export interface IDatabase {
    addMarketForResearch(pair: string, candlesticks: Candlestick[], period: string): void;
    getNextValueFromCachedMarketData(ti: TechnicalIndicator, price: number, pair: string, period: string, indicators: string[], periods: number[]): any;
    add(position: Position): Promise<any>;
    addAccounting(pair: string, qty: number, price: number, type: 'sell' | 'buy', lastUpdate: Date): void;
    update(position: Position): Promise<any>;
    getCurrentPositions(): Promise<Position[]>;
    findByPair(pair: string): Promise<any>;
}