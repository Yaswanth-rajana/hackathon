/**
 * Centralized severity mapper for the Admin Dashboard.
 * Single source of truth for risk thresholds and color palette.
 * Used by: StatsBar, HighRiskShopsTable, AnalyticsPage, ForecastPage
 */

export const RISK_THRESHOLDS = {
    CRITICAL: 90,
    HIGH: 75,
    MEDIUM: 50,
};

/**
 * Map a numeric risk score to a severity descriptor.
 * @param {number} score  - Risk score (0–100)
 * @returns {{ label: string, color: string, bg: string, border: string, emoji: string }}
 */
export const getRiskLevel = (score) => {
    if (score >= RISK_THRESHOLDS.CRITICAL) {
        return {
            label: 'CRITICAL',
            color: '#b91c1c',
            bg: '#fee2e2',
            border: '#fecaca',
            chartColor: '#ef4444',
            emoji: '🔴',
        };
    }
    if (score >= RISK_THRESHOLDS.HIGH) {
        return {
            label: 'HIGH',
            color: '#c2410c',
            bg: '#ffedd5',
            border: '#fed7aa',
            chartColor: '#f97316',
            emoji: '🟠',
        };
    }
    if (score >= RISK_THRESHOLDS.MEDIUM) {
        return {
            label: 'MEDIUM',
            color: '#a16207',
            bg: '#fef9c3',
            border: '#fef08a',
            chartColor: '#eab308',
            emoji: '🟡',
        };
    }
    return {
        label: 'LOW',
        color: '#166534',
        bg: '#dcfce7',
        border: '#bbf7d0',
        chartColor: '#22c55e',
        emoji: '🟢',
    };
};

/** Ordered colors for Recharts charts (Critical → High → Medium → Low) */
export const SEVERITY_CHART_COLORS = [
    '#ef4444', // Critical
    '#f97316', // High
    '#eab308', // Medium
    '#22c55e', // Low
    '#8b5cf6', // Other / fallback
];
