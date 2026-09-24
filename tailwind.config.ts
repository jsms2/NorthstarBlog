import type { Config } from 'tailwindcss'
export default <Partial<Config>>{
  darkMode: 'class',
  content: ['./app.vue', './components/**/*.{vue,ts}', './layouts/**/*.vue', './pages/**/*.vue'],
  theme: { extend: { colors: { ink: '#121826', paper: '#fbfaf7', accent: '#d75a32' }, fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'], serif: ['Source Serif 4', 'Georgia', 'serif'] } } }
}
