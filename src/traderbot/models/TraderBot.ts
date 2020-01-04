import { IDatabase } from "./IDatabase";


import { IExchange } from "./IExchange";
import { Position } from "./Position";

export class TraderBot {
    constructor(
        public db: IDatabase,
        public exchange: IExchange
    ) { }

    async sellOrder(pair: string, qty: number) {
        const order = await this.exchange.sellOrder(pair, qty);
        await this.db.addAccounting(pair, qty, order.price, 'buy', new Date());
        return order;
    }

    async placeOrder(pair: string, qty: number) {
        const order = await this.exchange.placeOrder(pair, qty);
        await this.db.addAccounting(pair, qty, order.price, 'sell', new Date());
        return order;
    }

    protected async addBalanceToPositions(pair: string, qty: number, update: boolean = false) {
        console.log(`add pair ${pair}`)
        // find by pair
        const found = await this.db.findByPair(pair);
        if (found) {
            console.log(`Pair ${pair} already in DB`);
            return;
        }
        const price = await this.exchange.getPrice(pair);
        // console.log(`price ${price.askPrice} ${price.error}`)
        if (price.error) return;
        const position = Position.createFromBalance(pair, qty, price.askPrice);
        //   console.log(position)
        await this.db.add(position);
        // console.log(`Place position: ${order.symbol} BUY ${order.origQty}@${order.price} - ${position.id}`);
    }
}