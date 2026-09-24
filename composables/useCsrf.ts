export function useCsrf(){const csrf=useCookie<string>('northstar_csrf');return computed(()=>({'x-csrf-token':csrf.value||''}))}
