<script lang="ts">
  import Table from "./AccountingTable.svelte";

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
      <div class="row">
        <Table items={accountingGroupByPairs} />
      </div>
    </div>
    <!-- ${reload} -->
</body>
