<script lang="ts">
  import Row from "./AccountingRow.svelte";

  export let items = {};
</script>

<table class="table table-dark table-sm">
  <thead>
    <tr>
      <th scope="col">Pair</th>
      <th scope="col">Sell</th>
      <th scope="col">Buy</th>
      <th scope="col">Profit</th>
    </tr>
  </thead>
  <tbody>
    {#each Object.values(items) as item}
      <Row group={item} />
    {/each}
  </tbody>
</table>
