import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import MainLayout from './layouts/MainLayout/MainLayout';
import AppRoutes from './routes';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <DataProvider>
          <MainLayout>
            <AppRoutes />
          </MainLayout>
        </DataProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
