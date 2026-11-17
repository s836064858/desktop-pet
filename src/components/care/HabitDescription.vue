<script setup lang="ts">
import { computed } from 'vue'
import { sanitizeHabitDescription } from '../../lib/richText'
const props = defineProps<{ description: string }>()
const safeDescription = computed(
  () => sanitizeHabitDescription(props.description) || '暂未提供习性介绍。',
)
</script>

<template>
  <div class="habit-description" v-html="safeDescription" />
</template>

<style scoped>
.habit-description {
  color: #64715c;
  font-size: 13px;
  line-height: 1.9;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.habit-description :deep(p) {
  margin: 0;
}
.habit-description :deep(p + p) {
  margin-top: 8px;
}
.habit-description :deep(ul),
.habit-description :deep(ol) {
  margin: 8px 0;
  padding-left: 22px;
}
.habit-description :deep(strong),
.habit-description :deep(b) {
  color: #456746;
}
.habit-description :deep(blockquote) {
  margin: 8px 0;
  padding-left: 12px;
  border-left: 2px solid #bdcbaa;
}
</style>
