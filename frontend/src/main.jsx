import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { CitizenAuthProvider } from './context/CitizenAuthContext'
import { AlertProvider } from './context/AlertContext'
import { DistrictProvider } from './context/DistrictContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <DistrictProvider>
        <AuthProvider>
          <CitizenAuthProvider>
            <AlertProvider>
              <App />
            </AlertProvider>
          </CitizenAuthProvider>
        </AuthProvider>
      </DistrictProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
