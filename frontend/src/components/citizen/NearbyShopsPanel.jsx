import React, { useState, useEffect } from 'react';
import { citizenActions } from '../../services/citizenApi';
import { MapPin, Search, Navigation, Store, Star, Phone, ArrowUpRight, Compass } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';

export default function NearbyShopsPanel() {
    const [shops, setShops] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const { showAlert } = useAlert();

    const findNearby = async () => {
        setIsSearching(true);
        setIsLoading(true);
        if (!navigator.geolocation) {
            showAlert("Geolocation not supported", "error");
            setIsLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const data = await citizenActions.getNearbyShops(pos.coords.latitude, pos.coords.longitude);
                setShops(data);
            } catch (err) {
                showAlert("Failed to find nearby shops", "error");
            } finally {
                setIsLoading(false);
            }
        }, () => {
            showAlert("Location access denied. Please enable GPS.", "warning");
            setIsLoading(false);
        });
    };

    // Auto-fetch a small preview on mount (simulated or using defaults if no geo)
    useEffect(() => {
        // For hackathon feel, we'll just show a "Ready to search" state or 
        // if we had a default location we'd fetch.
    }, []);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-emerald-500 h-full flex flex-col hover:shadow-lg transition-all">
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                        <Compass className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">Nearby Fair Price Shops</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Alternative Distribution Centers</p>
                    </div>
                </div>
            </div>

            {!isSearching ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 text-emerald-500 animate-bounce">
                        <MapPin className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-bold text-gray-700 mb-2">Find Ration Shops Near You</p>
                    <p className="text-xs text-gray-400 mb-6 max-w-[200px]">Use your current location to find the nearest authorized FPS centers.</p>
                    <button
                        onClick={findNearby}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-all"
                    >
                        <Search className="w-4 h-4" />
                        Search Nearby
                    </button>
                </div>
            ) : (
                <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[300px]">
                    {isLoading ? (
                        <div className="space-y-3">
                            <div className="h-16 bg-gray-50 rounded-xl animate-pulse"></div>
                            <div className="h-16 bg-gray-50 rounded-xl animate-pulse"></div>
                        </div>
                    ) : shops.length === 0 ? (
                        <p className="text-center text-gray-400 text-xs py-8 font-bold uppercase tracking-widest">No shops found within 10km.</p>
                    ) : (
                        shops.map(shop => (
                            <div key={shop.shop_id} className="p-4 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-white hover:border-emerald-200 transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <Store className="w-3.5 h-3.5 text-emerald-600" />
                                        <h4 className="font-bold text-gray-900 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px]">{shop.name}</h4>
                                    </div>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded uppercase tracking-tighter">
                                        {shop.distance_km.toFixed(1)} km
                                    </span>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                    <div className="flex items-center gap-1">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        <span className="text-xs font-bold text-gray-700">{shop.rating}</span>
                                    </div>
                                    <button className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1 group-hover:underline">
                                        <Navigation className="w-3 h-3" />
                                        Directions
                                        <ArrowUpRight className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                    <button
                        onClick={() => setIsSearching(false)}
                        className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        Reset Search
                    </button>
                </div>
            )}
        </div>
    );
}
