<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const range = ref(30)
const { data, refresh } = await useFetch('/api/admin/analytics', { query: { range } })
watch(range, () => refresh())
const max = computed(() => Math.max(1, ...(data.value?.trend || []).map((x) => x.views)))
</script>
<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-sm" style="color: var(--muted)">Privacy-friendly, self-hosted</p>
        <h1 class="text-3xl font-semibold">访问统计</h1>
      </div>
      <select v-model.number="range" class="rounded-lg border bg-transparent p-2">
        <option :value="7">近 7 天</option>
        <option :value="30">近 30 天</option>
        <option :value="90">近 90 天</option>
      </select>
    </div>
    <div class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div
        v-for="item in [
          { n: '今日 PV', v: data?.today.views || 0 },
          { n: '今日 UV', v: data?.today.visitors || 0 },
          { n: `${range} 天 PV`, v: data?.totals.views || 0 },
          { n: `${range} 天 UV`, v: data?.totals.visitors || 0 },
        ]"
        :key="item.n"
        class="rounded-xl border p-5"
        style="border-color: var(--border); background: var(--surface)"
      >
        <p style="color: var(--muted)">{{ item.n }}</p>
        <strong class="mt-2 block text-3xl">{{ item.v }}</strong>
      </div>
    </div>
    <section
      class="mt-8 rounded-xl border p-5"
      style="border-color: var(--border); background: var(--surface)"
    >
      <h2 class="font-semibold">浏览趋势</h2>
      <div class="mt-5 flex h-48 items-end gap-1 overflow-x-auto">
        <div
          v-for="d in data?.trend || []"
          :key="d.date"
          class="group relative min-w-2 flex-1 rounded-t"
          :title="`${d.date}: ${d.views} PV / ${d.visitors} UV`"
          :style="{
            height: `${Math.max(3, (d.views / max) * 100)}%`,
            background: 'var(--accent)',
            opacity: '.8',
          }"
        ></div>
      </div>
      <div class="mt-2 flex justify-between text-xs" style="color: var(--muted)">
        <span>{{ data?.trend[0]?.date }}</span
        ><span>{{ data?.trend[data.trend.length - 1]?.date }}</span>
      </div>
    </section>
    <div class="mt-8 grid gap-5 lg:grid-cols-2">
      <section
        v-for="group in [
          { name: '热门页面', rows: data?.popular },
          { name: '来源', rows: data?.referrers },
          { name: '浏览器', rows: data?.browsers },
          { name: '操作系统', rows: data?.systems },
          { name: '设备', rows: data?.devices },
        ]"
        :key="group.name"
        class="rounded-xl border p-5"
        style="border-color: var(--border); background: var(--surface)"
      >
        <h2 class="font-semibold">{{ group.name }}</h2>
        <div
          v-for="r in group.rows || []"
          :key="r.name"
          class="flex justify-between border-t py-2 text-sm"
          style="border-color: var(--border)"
        >
          <span class="truncate">{{ r.name }}</span
          ><span>{{ r.views }} PV</span>
        </div>
      </section>
    </div>
  </div>
</template>
