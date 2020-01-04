import { Candlestick } from "./Candlestick";

export class MarketResearchModel {
    pair: string;
    candlesticks: Candlestick[];
    lastUpdate: Date;
    period: string;
}

