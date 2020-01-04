<script lang="ts">
  export let pos;
  
  let { metrics, pair, lastPrice, qty } = pos;
  metrics = metrics || {};

  const cooldownBadge = pos.isCooldown
    ? '<span class="badge badge-primary">cooldown</span>'
    : "";
</script>

<tr>
  <td>
    <a href="https://www.tradingview.com/symbols/${pair}" class="card-link">
      ${pair}
    </a>
    ${cooldownBadge}
  </td>
  <td style="text-align: right;">$ ${lastPrice} ${changeSince}</td>
  <td>${qty}</td>
  <td>$ ${metrics.high ? metrics.high.toFixed(2) : ''}</td>
  <td>$ ${metrics.low ? metrics.low.toFixed(2) : ''}</td>
  <td>${metrics.changeHigh ? metrics.changeHigh.toFixed(2) : ''}</td>
  <td>${metrics.changeLow ? metrics.changeLow.toFixed(2) : ''}</td>
  <td>${metrics.canSell ? 'SELL' : '-'}</td>
  <td>${metrics.canBuy ? 'BUY' : '-'}</td>
  <td>
    ${metrics.trend ? '<span class="text-success">Bullish</span>' : '<span class="text-danger">Bearish</span>'}
  </td>
  <td>${metrics.isSMA ? 'Yes' : 'No'}</td>
  <td>${metrics.isEMA ? 'Yes' : 'No'}</td>
</tr>
