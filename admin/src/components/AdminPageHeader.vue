<script setup lang="ts">
defineProps<{ title: string; section: string }>()
</script>

<template>
  <header class="page-heading">
    <div>
      <p>{{ section }}</p>
      <h1>{{ title }}</h1>
    </div>
    <div v-if="$slots.actions" class="page-heading__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.page-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: end;
  gap: 0.75rem 1.25rem;
  margin-bottom: 1.65rem;
}
.page-heading p {
  margin: 0 0 0.3rem;
  color: var(--color-muted);
  font-size: 0.8rem;
  font-weight: 600;
}
.page-heading h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.25;
}
.page-heading__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
