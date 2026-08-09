import React from 'react'
import ReactDOM from 'react-dom/client'

import { App } from '@programkit/web'
import '@programkit/web/styles.css'

const deploymentProfile =
  document.querySelector<HTMLMetaElement>('meta[name="programkit-deployment-profile"]')?.content ??
  'single-workspace'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App
      deploymentProfile={
        deploymentProfile === 'hosted-demo' ||
        deploymentProfile === 'hosted-demo-entry' ||
        deploymentProfile === 'hosted-app'
          ? deploymentProfile
          : 'single-workspace'
      }
    />
  </React.StrictMode>,
)
