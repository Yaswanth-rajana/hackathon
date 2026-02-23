import { useState, useEffect, useCallback } from 'react';
import DealerHeader from '../components/dealer/DealerHeader';
import Footer from '../components/dealer/Footer';
import ShopInfoCard from '../components/dealer/ShopInfoCard';
import StatsBar from '../components/dealer/StatsBar';
import BeneficiaryLookup from '../components/dealer/BeneficiaryLookup';
import DistributionPanel from '../components/dealer/DistributionPanel';
import StockPanel from '../components/dealer/StockPanel';
import ComplaintPanel from '../components/dealer/ComplaintPanel';
import PerformancePanel from '../components/dealer/PerformancePanel';
import dealerApi from '../services/dealerApi';
import { useAlert } from '../context/AlertContext';
import { Loader2 } from 'lucide-react';

export default function DealerDashboard() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { showAlert } = useAlert();

    const [dashboardData, setDashboardData] = useState(null);
    const [stockData, setStockData] = useState(null);
    const [performanceData, setPerformanceData] = useState(null);
    const [complaintsData, setComplaintsData] = useState([]);

    const [activeBeneficiary, setActiveBeneficiary] = useState(null);

    const fetchAllData = useCallback(async (isInitial = true) => {
        if (isInitial) setLoading(true);
        else setRefreshing(true);

        try {
            const safeGet = async (url, fallback) => {
                try {
                    const res = await dealerApi.get(url);
                    return res;
                } catch (err) {
                    if (err.response?.status === 401) throw err; // Don't swallow auth errors
                    return { data: fallback };
                }
            };

            const [dashRes, stockRes, perfRes, compRes] = await Promise.all([
                safeGet('/dealer/dashboard', {}),
                safeGet('/dealer/stock', {}),
                safeGet('/dealer/performance', {}),
                safeGet('/dealer/complaints', [])
            ]);

            setDashboardData(dashRes.data);
            setStockData(stockRes.data);
            setPerformanceData(perfRes.data);
            setComplaintsData(Array.isArray(compRes.data) ? compRes.data : []);
        } catch (err) {
            showAlert('Some dashboard services are currently unavailable.', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showAlert]);

    useEffect(() => {
        fetchAllData(true);
    }, [fetchAllData]);

    const handleDistributionSuccess = () => {
        // Clear active beneficiary
        setActiveBeneficiary(null);
        // Refresh dashboard to reflect new stock and stats without full page reload loader
        fetchAllData(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
                <DealerHeader />
                <div className="flex-grow flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="w-12 h-12 text-[#003366] animate-spin mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-[#003366] uppercase tracking-wide">
                            Loading Secure Environment
                        </h2>
                        <p className="text-gray-500 mt-2 text-sm">Validating session and fetching data node...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[100vh] bg-[#F5F7FA] flex flex-col font-sans">
            <DealerHeader />

            <main className="flex-grow max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
                {refreshing && (
                    <div className="fixed top-20 right-8 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-sm text-xs font-semibold flex items-center shadow-sm z-50">
                        <span className="w-3 h-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mr-2"></span>
                        Syncing data...
                    </div>
                )}

                <div className="space-y-6">
                    {/* Top Layer: Info and Stats */}
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                        <div className="xl:col-span-1">
                            <ShopInfoCard data={dashboardData} />
                        </div>
                        <div className="xl:col-span-3">
                            <StatsBar stats={dashboardData?.stats || dashboardData} />
                        </div>
                    </div>

                    {/* Middle Layer: Ops grid-cols-4 md:grid-cols-2 sm:grid-cols-1 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Beneficiary Action Stack */}
                        <div className="flex flex-col gap-6 lg:col-span-2 grid-rows-[auto_1fr]">
                            {/* Fixed to not enforce grid-rows wrongly */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                                <div className="flex flex-col h-[500px]">
                                    <BeneficiaryLookup onBeneficiaryFound={setActiveBeneficiary} />
                                </div>
                                <div className="flex flex-col h-[500px]">
                                    <DistributionPanel beneficiary={activeBeneficiary} onDistributionSuccess={handleDistributionSuccess} />
                                </div>
                            </div>
                        </div>

                        {/* Stock Panel */}
                        <div className="h-[500px]">
                            <StockPanel stock={stockData} />
                        </div>

                    </div>

                    {/* Bottom Layer: Auditing and Performance */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
                        <div className="h-[400px]">
                            <ComplaintPanel complaints={complaintsData} setComplaints={setComplaintsData} />
                        </div>
                        <div className="h-[400px]">
                            <PerformancePanel performance={performanceData} />
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
