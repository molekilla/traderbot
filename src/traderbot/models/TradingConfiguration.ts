import { IBalances } from "./IBalances";
export interface TradingConfiguration {
    strategy: any;
    balances: () => IBalances;
    pairs: string;
    candlesticks: (symbol: string, period: string) => Promise<any>;
}
