import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/mal3abi-platform-/',
  plugins: [react()],
})
