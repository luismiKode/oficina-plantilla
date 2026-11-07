import { mount } from 'svelte';
import App from './App.svelte';
import './lib/marca.css';
mount(App, { target: document.getElementById('app') });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
