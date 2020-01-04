require('svelte/register');
import { MMMBotDB } from "./MMMBotDB";
import { forkJoin, from, merge } from "rxjs";
import { mergeMap, distinct, toArray } from 'rxjs/operators';
import { TechnicalIndicator } from "./indicators/TechnicalIndicator";
import { Position } from './traderbot/models/Position';
import { AccountingItem } from "./AccountingItem";
import { MMMBot } from "./binance/MMMBot";
import { MarginBot } from "./binance/MarginBot";
const Accounting = require('./dashboard/Accounting.svelte').default;

const sum = (items: number[]) => items.reduce((p, c) =>  p + c, 0);
const express = require('express');
export class Dashboard {
    binance: MMMBot;
    ti: TechnicalIndicator;
    cache: any = {};
    constructor(private db: MMMBotDB) {
        this.ti = new TechnicalIndicator();
    }


    render(req: any, res: any) {
        this.db.getCurrentPositions({ include: "all" }).then(async  positions => {
            const balances: any = await this.db.loadMarginBalances();
            if (!balances) {
                res.send('No balances');
                return;
            }
            const reload = `<script>
            setInterval(() => location.reload(), 20 * 1000);
            </script>`;


            const row = (changeSince: any, pos: Position) => {
                let { metrics, pair, lastPrice, qty } = pos;
                metrics = metrics || {
                } as any;

                const cooldownBadge = pos.isCooldown ? '<span class="badge badge-primary">cooldown</span>' : '';
                return `<tr>
                  <td><a href="https://www.tradingview.com/symbols/${pair}" class="card-link">${pair}</a>
                  ${cooldownBadge}</td>
                  <td style="text-align: right;">$ ${lastPrice} ${changeSince}</td>
                  <td>${qty}</td>
                  <td>$ ${metrics.high ? metrics.high.toFixed(4) : ''}</td>
                  <td>$ ${metrics.low ? metrics.low.toFixed(4) : ''}</td>
                  <td>${metrics.changeHigh ? metrics.changeHigh.toFixed(4) : ''}</td>
                  <td>${metrics.changeLow ? metrics.changeLow.toFixed(4) : ''}</td>
                  <td>${metrics.canSell ? 'SELL' : '-'}</td>
                  <td>${metrics.canBuy ? 'BUY' : '-'}</td>     
                  <td>${metrics.trend ? '<span class="text-success">Bullish</span>' : '<span class="text-danger">Bearish</span>'}</td>     
                  <td>${metrics.isSMA ? 'Yes' : 'No'}</td>     
                  <td>${metrics.isEMA ? 'Yes' : 'No'}</td>     
                </tr>`;
            }

            const table = positions.map(pos => {
                let change;
                if (!pos.lastPrice) {
                    pos.lastPrice = pos.buyPrice;
                }
                if (pos.metrics && pos.metrics.changeSinceLastOrder) {
                    change = `<span class="badge badge-danger">${(100 * pos.metrics.changeSinceLastOrder).toFixed(2)} %</span>`;
                    if (pos.metrics.changeSinceLastOrder > 0) {
                        change = `<span class="badge badge-success">${(100 * pos.metrics.changeSinceLastOrder).toFixed(2)} %</span>`;
                    }
                }

                return row(change, pos);
            });

            // main
            const head = `<head><link rel="stylesheet" 
            href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" 
            integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous"></head>`;
            const template = `<html>${head}<body><div class="container-fluid">
            <div class="d-flex flex-row">
            <div class="display-4 d-flex flex-fill">${balances.USDT.available} USDT</div>
            <div class="display-4 d-flex flex-fill">${balances.BTC.available} BTC</div>
            </div>
            <div class="row">
            <table class="table table-dark table-sm">
  <thead>
    <tr>
      <th scope="col">Pair</th>
      <th scope="col">Last Price / Change Since Last</th>
      <th scope="col">Qty</th>
      <th scope="col">High (SMA)</th>
      <th scope="col">Low (SMA)</th>
      <th scope="col">Change High % (SMA)</th>
      <th scope="col">Change Low % (SMA)</th>
      <th scope="col">Should Sell</th>
      <th scope="col">Should Buy</th>
      <th scope="col">Trend</th>
      <th scope="col">SMA range</th>
      <th scope="col">EMA range</th>
    </tr>
  </thead>
  <tbody>
  ${table.join(' ')}
  </tbody>
</table>            
            </div></div>${reload}</body></html>`;
            res.send(template);
        });
    }

    renderROI(req: any, res: any) {
        this.db.getAccounting().then(async  items => {

            const accountingGroupByPairs: any = {};

            items.forEach((i: AccountingItem) => {
                if (accountingGroupByPairs[i.pair]) {
                    accountingGroupByPairs[i.pair] = [...accountingGroupByPairs[i.pair], i];
                } else {
                    accountingGroupByPairs[i.pair] = [i];
                }
            });

            const reload = `<script>
            setInterval(() => location.reload(), 120 * 1000);
            </script>`;

        const { html, css, head } = Accounting.render({ accountingGroupByPairs });
        res.send(`${head}${html}`);

      });
    }

    startWebServer() {
        const app = express();

        const port = 8888;

        app.get('/', this.render.bind(this));
        app.get('/roi', this.renderROI.bind(this));
        // app.post('/scalper', this.setScalper.bind(this));


        app.listen(port, () => {
            console.log('Started');
        });

    }
}
