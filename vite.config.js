import { defineConfig } from 'vite';

export default defineConfig({
	base: './',
	build: {
		outDir: 'dist',
		assetsDir: 'assets',
		sourcemap: false
	},
	publicDir: 'public',
	server: {
		port: 3000
	},
	test: {
		environment: 'jsdom',
		setupFiles: './test/setupTests.js'
	}
});
