import { IStrategy } from "./IStrategy";
export interface IBalances {
    [key: string]: any;
}
export interface TradingConfiguration {
    strategy: any;
    balances: () => IBalances;
    pairs: string;
    candlesticks: string;
}
export interface IBot{
    balances: any;
    sellOrder: any;
    placeOrder: any;
    trade(): void; 
    configure(options: TradingConfiguration): void;
}