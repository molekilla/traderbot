import { Db, Server, MongoClient } from 'mongodb';
import { Position } from './traderbot/models/Position';
import { AccountingItem } from './AccountingItem';
import { Candlestick } from './indicators/Candlestick';
import { MarketResearchModel } from './indicators/MarketResearchModel';
import { BigNumber } from 'bignumber.js';
import { TechnicalIndicator } from './indicators/TechnicalIndicator';
import { ScalperItem } from './binance/scalping/ScalperItem';
import { ScalperOptions } from './binance/scalping/GenericScalper';
import { Balances } from './binance/MarginBot';


export interface CandlestickMarketModel {
    candlesticks: Candlestick[];
    dataset: {
        open: number[];
        high: number[];
        close: number[];
        low: number[];
    }
}
export class MMMBotDB {
    db!: Db;
    cache: any = {};
    constructor() {
    }

    public async addAccounting(pair: string, qty: number, price: number, type: 'sell' | 'buy', lastUpdate: Date = new Date()) {
        const coll = this.db.collection('accounting');
        /*
                const found = await coll.findOne({ pair, period });
        
                if (found) {
                    await coll.deleteOne({ _id: found._id });
                }
        */

        const item = new AccountingItem();
        item.pair = pair;
        item.amount = (new BigNumber(qty * price)).toNumber();
        item.timestamp = lastUpdate.getTime();
        item.exchange = 'binance';
        item.price = price;
        item.qty = qty;
        item.credit = type === 'sell' ? true : false;

        return await coll.insertOne(item);

    }

    public async addMarketForResearch(pair: string, candlesticks: Candlestick[], period: string) {
        const lastUpdate: Date = new Date();
        const coll = this.db.collection('markets');

        const found = await coll.findOne({ pair, period });

        if (found) {
            await coll.deleteOne({ _id: found._id });
        }


        console.log(`Adding market candlesticks ${pair} for period ${period}`);

        const marketResearchModel = new MarketResearchModel();
        marketResearchModel.pair = pair;
        marketResearchModel.candlesticks = candlesticks;
        marketResearchModel.lastUpdate = lastUpdate;
        marketResearchModel.period = period;
        return await coll.insertOne(marketResearchModel);

    }


    public async getMarketData(pair: string, period: string): Promise<CandlestickMarketModel> {
        const coll = this.db.collection('markets');

        const data = await coll.findOne({ pair, period });
        
        if (!data) {
            console.log(`no data for ${pair} for ${period}`);
            return { } as CandlestickMarketModel
        }
        const ticks = data.candlesticks;


        const open: number[] = ticks.map((t: Candlestick) => new BigNumber(t.open).toNumber());
        const close: number[] = ticks.map((t: Candlestick) => new BigNumber(t.close).toNumber());
        const high: number[] = ticks.map((t: Candlestick) => new BigNumber(t.high).toNumber());
        const low: number[] = ticks.map((t: Candlestick) => new BigNumber(t.low).toNumber());

        return { candlesticks: ticks, dataset: { open, close, high, low } } as CandlestickMarketModel;

    }

    public async getNextValueFromCachedMarketData(ti: TechnicalIndicator, price: number, pair: string, period: string, indicators: string[], periods: number[]) {
        let md: CandlestickMarketModel;
        if (!this.cache[pair]) {
            md = await this.getMarketData(pair, period);
            this.cache[pair] = md;
        }
        md = this.cache[pair];

        let result = {
            pair,
            AO: 0,
        }
        const p = new BigNumber(price);
        if (price === undefined || !price) return result;
        indicators.map(indicator => {
            if (indicator === 'AO') {
                // result.AO = ti.getNextAO(md, p.toNumber() as any);
                console.log(result.AO)
            } else {
                result = {
                    ...result,
                    [indicator]: {
                        close: ti.getNext(indicator, price, periods, md.dataset.close),
                        open: ti.getNext(indicator, price, periods, md.dataset.open),
                        high: ti.getNext(indicator, price, periods, md.dataset.high),
                        low: ti.getNext(indicator, price, periods, md.dataset.low),
                    }
                };
            }
        })
        return result;
    }

    public async init() {
        const mongo = MongoClient;
        const client = await mongo.connect('mongodb://127.0.0.1:27017', {
            useNewUrlParser: true
        });
        this.db = client.db('mmmbot');
    }


    /**
     * Saves margin balances
     * @param balances margin balances object
     */
    public async saveMarginBalances(balances: Balances) {
        const coll = this.db.collection('balances');
        const found = await coll.findOne({ id: 'margin' });
        if (found) {
            await coll.updateOne({ id: 'margin' }, { $set: { data: balances } });
        } else {
            const bal = Object.assign({}, { id: 'margin' }, { data: balances });
            await coll.insertOne(bal);
        }
    }

    /**
     * Gets margin balances
     */
    public async loadMarginBalances() {
        const coll = this.db.collection('balances');
        const data = await coll.findOne({ id: 'margin' });

        if (data) {
            return data.data;
        } else {
            return null;
        }
    }

    public async update(position: Position) {
        const coll = this.db.collection('positions');
        if (position) {
            return await coll.updateOne({ id: position.id }, { $set: position });
            // await this.remove(position.id)
            // await this.add(position)
        }
    }

    public async add(position: Position) {
        const coll = this.db.collection('positions');
        // ts-ignore
        position._id = undefined;

        const doc = await coll.insertOne(position);

        return doc;
    }


    public async remove(id: string) {
        const coll = this.db.collection('positions');

        const doc = await coll.deleteOne({ id });

        return doc;
    }
    public async getCurrentPositions(options?: any): Promise<Position[]> {
        const coll = this.db.collection('positions');

        const positions = await coll.find({ sold: false }).toArray();

        return positions;
    }

    public async getAccounting(): Promise<AccountingItem[]> {
        const coll = this.db.collection('accounting');

        const items = await coll.find().toArray();

        return items;
    }

    public async getScalpers(): Promise<ScalperItem[]> {
        const coll = this.db.collection('scalpers');

        const items = await coll.find().toArray();

        return items;
    }

    public async addScalper(item: ScalperItem): Promise<ScalperItem> {
        const coll = this.db.collection('scalpers');

        const doc = await coll.insertOne(item);

        return item;
        // 'LTCUSDT', 'LTC', {
        // qty: 0.5,
        // changePerc: 0.015,
        // buyPriceDiff: 0.95,
        // sellPriceDiff: 1.12,
    }

    public async updateScalper(pair: string, options: ScalperOptions) {
        const coll = this.db.collection('scalpers');

        return await coll.updateOne({ pair }, {
            $set: {
                options,
            }
        });
    }

    public async activateScalper(pair: string, enabled: boolean) {
        const coll = this.db.collection('scalpers');

        return await coll.updateOne({ pair }, {
            $set: {
                enabled,
            }
        });
    }

    public async hasPositions() {
        const coll = this.db.collection('positions');
        const count = await coll.estimatedDocumentCount();
        return count > 0;
    }

    public async hasActivePositions() {
        const coll = this.db.collection('positions');
        const positions = await coll.find({ sold: false }).toArray();
        return positions.length > 0;
    }

    public findByPairQty(pair: string, qty: number) {
        const coll = this.db.collection('positions');
        return coll.findOne({ sold: false, pair, qty });
    }

    public findByPair(pair: string) {
        const coll = this.db.collection('positions');
        return coll.findOne({ sold: false, pair });
    }

    public async removePair(pair: string) {
        const coll = this.db.collection('positions');
        await coll.deleteMany({ pair });
        return;
    }
}