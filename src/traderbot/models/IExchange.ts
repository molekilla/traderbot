import { Observable } from "rxjs";
import { Position } from "./Position";

export interface IExchange {
    tradeEvent: Observable<any>;
    getPrice(pair: string): any;
    getBalance(): any;
    orderStatus(pos: Position): Promise<any>;
    candlesticks(pair: string, period: string): Promise<any[]>;
    subscribeTrades(pairs: string[]): Observable<any>;
    configure(): void;
    placeOrder(pair: string, amount: number): Promise<any>;
    sellOrder(pair: string, qty: number): Promise<any>;
}