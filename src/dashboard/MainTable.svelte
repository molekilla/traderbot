<script lang="ts">
  import Row from "./MainTableRow.svelte";

  export let items = {};
</script>

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
    {#each Object.values(items) as item}
      <Row group={item} />
    {/each}
  </tbody>
</table>
