<script lang="ts">
  export let group = [{ pair: ''}];

  $: sell = group
    .filter(i => i.credit)
    .map(i => i.amount)
    .reduce((p, c) => p + c, 0);
  $: buy = group
    .filter(i => !i.credit)
    .map(i => i.amount)
    .reduce((p, c) => p + c, 0);
  $: profit = (100 * ((sell - buy) / sell)).toFixed(2);
  let pair = group[0].pair;
</script>
<tr>
  <td>
    <a href="https://www.tradingview.com/symbols/{pair}" class="card-link">
      {pair}
    </a>
  </td>
  <td>$ {sell}</td>
  <td>$ {buy}</td>
  <td>{profit} %</td>
</tr>
