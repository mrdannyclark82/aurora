
import { useState, useEffect } from 'react';
import { GeolocationState } from '../types';

export const useGeolocation = (): GeolocationState => {
  const [state, setState] = useState<GeolocationState>({
    loading: true,
    coordinates: null,
    error: null,
  });

  useEffect(() => {
    const onEvent = ({ coords }: { coords: GeolocationCoordinates }) => {
      setState({ loading: false, coordinates: coords, error: null });
    };

    const onError = (error: GeolocationPositionError) => {
      setState({ loading: false, coordinates: null, error });
    };

    navigator.geolocation.getCurrentPosition(onEvent, onError);

    const watchId = navigator.geolocation.watchPosition(onEvent, onError);

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return state;
};
