import React, { createContext, useContext, useState, useEffect } from 'react';

const DistrictContext = createContext();

export const useDistrict = () => {
    const context = useContext(DistrictContext);
    if (!context) {
        throw new Error('useDistrict must be used within a DistrictProvider');
    }
    return context;
};

export const DistrictProvider = ({ children }) => {
    const [selectedDistrict, setSelectedDistrict] = useState(
        localStorage.getItem("selected_district") || "Visakhapatnam"
    );

    useEffect(() => {
        localStorage.setItem("selected_district", selectedDistrict);
    }, [selectedDistrict]);

    return (
        <DistrictContext.Provider value={{ selectedDistrict, setSelectedDistrict }}>
            {children}
        </DistrictContext.Provider>
    );
};
