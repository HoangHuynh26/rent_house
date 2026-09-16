import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const TenantRoomContext = createContext(null);

export const TenantRoomProvider = ({ children }) => {
  const { tenant } = useAuth();
  const [rentedRooms, setRentedRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(() => {
    return localStorage.getItem('tenant_active_room_id') || '';
  });

  // Sync rented rooms from tenant or fetch from dashboard API
  useEffect(() => {
    if (!tenant) {
      setRentedRooms([]);
      return;
    }

    if (Array.isArray(tenant.rented_rooms) && tenant.rented_rooms.length > 0) {
      setRentedRooms(tenant.rented_rooms);
      const saved = localStorage.getItem('tenant_active_room_id');
      const isSavedValid = saved && tenant.rented_rooms.some((r) => r.id === saved);
      if (isSavedValid) {
        setActiveRoomId(saved);
      } else {
        const defaultId = tenant.rented_rooms[0].id;
        setActiveRoomId(defaultId);
        localStorage.setItem('tenant_active_room_id', defaultId);
      }
    } else {
      // Fetch dashboard to get latest rented_rooms
      api.get('/tenant/dashboard')
        .then((res) => {
          const rooms = res.data?.rented_rooms || (res.data?.room ? [res.data.room] : []);
          if (rooms.length > 0) {
            setRentedRooms(rooms);
            const saved = localStorage.getItem('tenant_active_room_id');
            const isSavedValid = saved && rooms.some((r) => r.id === saved);
            const chosenId = isSavedValid ? saved : rooms[0].id;
            setActiveRoomId(chosenId);
            localStorage.setItem('tenant_active_room_id', chosenId);
          }
        })
        .catch((err) => {
          console.warn('[TenantRoomContext] Fetch dashboard error:', err.message);
        });
    }
  }, [tenant]);

  const switchRoom = (roomId) => {
    if (!roomId || roomId === activeRoomId) return;
    setActiveRoomId(roomId);
    localStorage.setItem('tenant_active_room_id', roomId);
  };

  const activeRoom = useMemo(() => {
    return rentedRooms.find((r) => r.id === activeRoomId) || rentedRooms[0] || null;
  }, [rentedRooms, activeRoomId]);

  return (
    <TenantRoomContext.Provider
      value={{
        rentedRooms,
        setRentedRooms,
        activeRoomId,
        activeRoom,
        switchRoom,
        hasMultipleRooms: rentedRooms.length > 1
      }}
    >
      {children}
    </TenantRoomContext.Provider>
  );
};

export const useTenantRoom = () => {
  const ctx = useContext(TenantRoomContext);
  if (!ctx) {
    return {
      rentedRooms: [],
      activeRoomId: '',
      activeRoom: null,
      switchRoom: () => {},
      hasMultipleRooms: false
    };
  }
  return ctx;
};
