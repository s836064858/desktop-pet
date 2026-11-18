<script setup lang="ts">
import brandLogo from '../../../src/assets/brand/logo.png'
</script>

<template>
  <div class="brand-mark">
    <img :src="brandLogo" alt="" width="42" height="42" />
    <span class="brand-mark__name">芽伴 <span class="brand-mark__english">SPROUTKIN</span></span>
  </div>
</template>

<style scoped>
.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 1.04rem;
  font-weight: 700;
  white-space: nowrap;
}

.brand-mark img {
  object-fit: contain;
  border-radius: 8px;
  background: #fff;
}

.brand-mark__name {
  display: grid;
  gap: 0.03rem;
}

.brand-mark__english {
  font-size: 0.65rem;
  font-weight: 600;
  opacity: 0.8;
}
</style>
