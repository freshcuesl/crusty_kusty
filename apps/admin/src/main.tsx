import '@fontsource/fredoka/latin-600.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createSupabaseClient } from '@ck/core';
import { AdminApp } from './AdminApp';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <AdminApp supabase={createSupabaseClient(import.meta.env)} />
  </StrictMode>,
);
