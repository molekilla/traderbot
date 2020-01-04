import { IStrategy } from "./IStrategy";
import { TradingConfiguration } from "./TradingConfiguration";
export interface IBot{
    balances: any;
    sellOrder: any;
    placeOrder: any;
    trade(): void; 
    configure(options: TradingConfiguration): void;
}