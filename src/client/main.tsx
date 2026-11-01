import { createRoot } from 'react-dom/client';
import App from './App.js';

const element = document.getElementById('root');
if (!element) throw new Error('App root is missing.');
createRoot(element).render(<App/>);
