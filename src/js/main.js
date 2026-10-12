import { App } from './ui/app.js';

const app = new App();
window.warstories = app; // handy for debugging in the console
app.init().catch(err => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.style.cssText = 'color:#b00;padding:20px;white-space:pre-wrap';
  pre.textContent = `Startup error: ${err.message}`;
  document.body.append(pre);
});
