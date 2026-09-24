<script setup lang="ts">
useHead({ script: [{ innerHTML: "(()=>{try{const m=localStorage.getItem('color-mode')||'system';if(m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch{}})()", tagPosition: 'head' }] })
</script>
<template><NuxtLayout><NuxtPage /></NuxtLayout></template>
