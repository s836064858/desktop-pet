<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
const paths: Record<string, string> = {
  leaf: 'M20 4C10 2 3 6 4 13s12 9 16-9Z M5 19 15 9 M8 15v-4 M11 12h4',
  water: 'M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12Z M8 15a4 4 0 0 0 4 4',
  sun: 'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  calendar: 'M5 5h14v16H5Z M8 2v6 M16 2v6 M5 11h14 M9 15h2 M13 15h2',
  chart: 'M5 20V10 M12 20V4 M19 20v-7',
  sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z M21 2v4 M19 4h4',
  key: 'M14 5a5 5 0 1 1-2 8l-7 7H2v-3l7-7a5 5 0 0 1 5-5Z M15 8h.01',
  refresh: 'M20 8a8 8 0 1 0 0 8 M20 3v5h-5',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  check: 'm5 12 4 4L19 6',
  moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
  smile: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M8 9h.01 M16 9h.01 M8 14q4 5 8 0',
  external: 'M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5 M15 3h6v6 M10 14 21 3',
}
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="app-icon"
  >
    <path :d="paths[name] || paths.leaf" />
  </svg>
</template>
<style scoped>
.app-icon {
  flex-shrink: 0;
  vertical-align: middle;
}
</style>
