import React from 'react'
import ReactDOM from 'react-dom/client'

import { App } from './App.tsx'
import { WorkspaceProvider } from './lib/workspace.tsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </React.StrictMode>,
)
