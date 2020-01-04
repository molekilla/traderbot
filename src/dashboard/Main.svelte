<script lang="ts">
  import Table from "./MainTable.svelte";

  export let accountingGroupByPairs = {};
</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css"
    integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T"
    crossorigin="anonymous" />
</svelte:head>
<body>
  <div class="container-fluid">
    <div class="d-flex flex-row">
      <div class="display-4 d-flex flex-fill">
        {balances.USDT.available} USDT
      </div>
      <div class="display-4 d-flex flex-fill">
        {balances.BTC.available} BTC
      </div>
    </div>
    <div class="row">
      <Table items={accountingGroupByPairs} />
    </div>
  </div>
</body>
