
export interface PlaceData {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

export const extractPlaceData = (place: {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  id?: string;
}): PlaceData => {
  const placeData: PlaceData = {
    name: '',
  };

  try {
    console.log('🗺️ Google Place object received:', {
      displayName: place.displayName,
      formattedAddress: place.formattedAddress,
      location: place.location ? 'present' : 'missing',
      place_id: place.place_id
    });

    // Extract display name - prioritize formattedAddress for complete location context
    if (place.formattedAddress) {
      placeData.name = place.formattedAddress;
      console.log('✅ Using formattedAddress as name:', place.formattedAddress);
    } else if (place.displayName) {
      placeData.name = place.displayName;
      console.log('⚠️ Fallback to displayName as name:', place.displayName);
    }

    // Extract formatted address (for fallback purposes)
    if (place.formattedAddress) {
      placeData.address = place.formattedAddress;
    }

    // Extract coordinates
    if (place.location) {
      placeData.latitude = place.location.lat();
      placeData.longitude = place.location.lng();
      console.log('📍 Coordinates extracted:', {
        latitude: placeData.latitude,
        longitude: placeData.longitude
      });
    } else {
      console.warn('⚠️ No coordinates available from Google Place');
    }

    // Extract place ID
    if (place.place_id) {
      placeData.placeId = place.place_id;
    }

    console.log('📊 Final extracted place data:', placeData);
  } catch (error) {
    console.error('❌ Error extracting place data:', error);
  }

  return placeData;
};
