'use client';
import { createContext, useContext } from 'react';
export const ConnectionContext = createContext(true);
export const useBackendConnection = () => useContext(ConnectionContext);
