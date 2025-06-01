/**
 * Chart management module for Pool Automation Dashboard
 * Handles all Chart.js instances with proper cleanup and memory management
 */

const ChartManager = (function() {
    'use strict';
    
    // Store all chart instances for cleanup
    const chartInstances = new Map();
    const chartConfigs = new Map();
    
    // Default chart options
    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: DashboardConfig?.charts?.animationDuration || 0
        },
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    usePointStyle: true,
                    font: {
                        size: 12
                    }
                }
            },
            tooltip: {
                enabled: true,
                mode: 'index',
                intersect: false
            }
        }
    };
    
    /**
     * Create or update a chart
     * @param {string} chartId - Canvas element ID
     * @param {Object} config - Chart configuration
     * @returns {Chart} - Chart.js instance
     */
    function createChart(chartId, config) {
        const canvas = document.getElementById(chartId);
        if (!canvas) {
            console.error(`Canvas element ${chartId} not found`);
            return null;
        }
        
        // Destroy existing chart if it exists
        destroyChart(chartId);
        
        // Merge with default options
        const mergedConfig = {
            ...config,
            options: mergeDeep(defaultOptions, config.options || {})
        };
        
        try {
            const ctx = canvas.getContext('2d');
            const chart = new Chart(ctx, mergedConfig);
            
            // Store instance and config
            chartInstances.set(chartId, chart);
            chartConfigs.set(chartId, mergedConfig);
            
            // Add resize observer for better responsiveness
            if (window.ResizeObserver) {
                const resizeObserver = new ResizeObserver(debounce(() => {
                    chart.resize();
                }, 250));
                resizeObserver.observe(canvas.parentElement);
                
                // Store observer for cleanup
                chart._resizeObserver = resizeObserver;
            }
            
            return chart;
        } catch (error) {
            console.error(`Error creating chart ${chartId}:`, error);
            return null;
        }
    }
    
    /**
     * Update chart data efficiently
     * @param {string} chartId - Chart ID
     * @param {Object} newData - New data object
     * @param {boolean} animate - Whether to animate the update
     */
    function updateChartData(chartId, newData, animate = false) {
        const chart = chartInstances.get(chartId);
        if (!chart) {
            console.warn(`Chart ${chartId} not found`);
            return;
        }
        
        try {
            // Update labels if provided
            if (newData.labels) {
                chart.data.labels = newData.labels;
            }
            
            // Update datasets
            if (newData.datasets) {
                newData.datasets.forEach((dataset, index) => {
                    if (chart.data.datasets[index]) {
                        // Update existing dataset
                        Object.assign(chart.data.datasets[index], dataset);
                    } else {
                        // Add new dataset
                        chart.data.datasets.push(dataset);
                    }
                });
                
                // Remove extra datasets
                if (chart.data.datasets.length > newData.datasets.length) {
                    chart.data.datasets.splice(newData.datasets.length);
                }
            }
            
            // Update chart
            chart.update(animate ? 'default' : 'none');
        } catch (error) {
            console.error(`Error updating chart ${chartId}:`, error);
        }
    }
    
    /**
     * Destroy a chart and clean up resources
     * @param {string} chartId - Chart ID
     */
    function destroyChart(chartId) {
        const chart = chartInstances.get(chartId);
        if (!chart) return;
        
        try {
            // Clean up resize observer
            if (chart._resizeObserver) {
                chart._resizeObserver.disconnect();
                delete chart._resizeObserver;
            }
            
            // Destroy chart
            chart.destroy();
            
            // Remove from maps
            chartInstances.delete(chartId);
            chartConfigs.delete(chartId);
        } catch (error) {
            console.error(`Error destroying chart ${chartId}:`, error);
        }
    }
    
    /**
     * Destroy all charts
     */
    function destroyAllCharts() {
        chartInstances.forEach((chart, chartId) => {
            destroyChart(chartId);
        });
    }
    
    /**
     * Get a chart instance
     * @param {string} chartId - Chart ID
     * @returns {Chart|null} - Chart instance or null
     */
    function getChart(chartId) {
        return chartInstances.get(chartId) || null;
    }
    
    /**
     * Create chemistry chart
     * @returns {Chart} - Chart instance
     */
    function createChemistryChart() {
        const config = {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'pH',
                        data: [],
                        borderColor: 'rgba(13, 110, 253, 1)',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        yAxisID: 'y-ph'
                    },
                    {
                        label: 'Free Chlorine',
                        data: [],
                        borderColor: 'rgba(25, 135, 84, 1)',
                        backgroundColor: 'rgba(25, 135, 84, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        yAxisID: 'y-chlorine'
                    }
                ]
            },
            options: {
                scales: {
                    x: {
                        ticks: {
                            maxTicksLimit: 8,
                            autoSkip: true
                        }
                    },
                    'y-ph': {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'pH'
                        },
                        min: 6.8,
                        max: 8.0
                    },
                    'y-chlorine': {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Chlorine (mg/L)'
                        },
                        min: 0,
                        max: 3.0,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        };
        
        return createChart('chemistryChart', config);
    }
    
    /**
     * Create turbidity chart
     * @returns {Chart} - Chart instance
     */
    function createTurbidityChart() {
        const config = {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Turbidity (NTU)',
                        data: [],
                        borderColor: 'rgba(13, 110, 253, 1)',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'PAC Dosing',
                        data: [],
                        borderColor: 'rgba(220, 53, 69, 0.8)',
                        backgroundColor: 'rgba(220, 53, 69, 0.8)',
                        borderWidth: 0,
                        pointRadius: 8,
                        pointStyle: 'triangle',
                        pointRotation: 180,
                        showLine: false,
                        type: 'scatter'
                    }
                ]
            },
            options: {
                scales: {
                    x: {
                        ticks: {
                            maxTicksLimit: 8,
                            autoSkip: true
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Turbidity (NTU)'
                        },
                        min: 0.05,
                        max: 0.5
                    }
                }
            }
        };
        
        return createChart('turbidityChart', config);
    }
    
    /**
     * Create history chart with multiple parameters
     * @returns {Chart} - Chart instance
     */
    function createHistoryChart() {
        const config = {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'pH',
                        data: [],
                        borderColor: 'rgba(13, 110, 253, 1)',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y-ph',
                        hidden: false
                    },
                    {
                        label: 'ORP',
                        data: [],
                        borderColor: 'rgba(108, 117, 125, 1)',
                        backgroundColor: 'rgba(108, 117, 125, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y-orp',
                        hidden: true
                    },
                    {
                        label: 'Free Chlorine',
                        data: [],
                        borderColor: 'rgba(25, 135, 84, 1)',
                        backgroundColor: 'rgba(25, 135, 84, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y-chlorine',
                        hidden: false
                    },
                    {
                        label: 'Combined Chlorine',
                        data: [],
                        borderColor: 'rgba(25, 135, 84, 0.6)',
                        backgroundColor: 'rgba(25, 135, 84, 0.05)',
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        tension: 0.4,
                        yAxisID: 'y-chlorine',
                        hidden: true
                    },
                    {
                        label: 'Turbidity',
                        data: [],
                        borderColor: 'rgba(220, 53, 69, 1)',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y-turbidity',
                        hidden: true
                    },
                    {
                        label: 'Temperature',
                        data: [],
                        borderColor: 'rgba(255, 193, 7, 1)',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y-temp',
                        hidden: true
                    }
                ]
            },
            options: {
                scales: {
                    x: {
                        ticks: {
                            maxTicksLimit: 10,
                            autoSkip: true
                        }
                    },
                    'y-ph': {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'pH' },
                        min: 6.8,
                        max: 8.0
                    },
                    'y-chlorine': {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'Chlorine (mg/L)' },
                        min: 0,
                        max: 3.0,
                        grid: { drawOnChartArea: false }
                    },
                    'y-orp': {
                        type: 'linear',
                        position: 'right',
                        title: { display: false, text: 'ORP (mV)' },
                        min: 600,
                        max: 800,
                        display: false
                    },
                    'y-turbidity': {
                        type: 'linear',
                        position: 'right',
                        title: { display: false, text: 'Turbidity (NTU)' },
                        min: 0,
                        max: 0.5,
                        display: false
                    },
                    'y-temp': {
                        type: 'linear',
                        position: 'right',
                        title: { display: false, text: 'Temperature (°C)' },
                        min: 20,
                        max: 32,
                        display: false
                    }
                },
                plugins: {
                    legend: {
                        onClick: null // Disable legend click
                    }
                }
            }
        };
        
        const chart = createChart('historyChart', config);
        
        // Set up axis visibility management
        if (chart) {
            chart.updateAxisVisibility = updateHistoryChartAxisVisibility;
        }
        
        return chart;
    }
    
    /**
     * Update history chart axis visibility based on dataset visibility
     */
    function updateHistoryChartAxisVisibility() {
        const chart = getChart('historyChart');
        if (!chart) return;
        
        const axisMap = {
            0: 'y-ph',
            1: 'y-orp',
            2: 'y-chlorine',
            3: 'y-chlorine',
            4: 'y-turbidity',
            5: 'y-temp'
        };
        
        // Check which axes should be visible
        const visibleAxes = new Set();
        chart.data.datasets.forEach((dataset, index) => {
            if (!dataset.hidden) {
                visibleAxes.add(axisMap[index]);
            }
        });
        
        // Update axis visibility
        Object.keys(chart.options.scales).forEach(axis => {
            if (axis === 'x') return;
            
            const shouldBeVisible = visibleAxes.has(axis);
            chart.options.scales[axis].display = shouldBeVisible;
            
            if (chart.options.scales[axis].title) {
                chart.options.scales[axis].title.display = shouldBeVisible;
            }
        });
        
        chart.update('none');
    }
    
    /**
     * Generate sample data for testing
     * @param {number} points - Number of data points
     * @param {number} baseValue - Base value
     * @param {number} variation - Variation amount
     * @returns {Array} - Array of data points
     */
    function generateSampleData(points, baseValue, variation) {
        const data = [];
        for (let i = 0; i < points; i++) {
            const trend = Math.sin(i / 10) * variation * 0.5;
            const random = (Math.random() - 0.5) * variation;
            data.push(baseValue + trend + random);
        }
        return data;
    }
    
    /**
     * Generate time labels
     * @param {number} hours - Number of hours
     * @returns {Array} - Array of time labels
     */
    function generateTimeLabels(hours) {
        const labels = [];
        const now = new Date();
        
        for (let i = hours - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setHours(date.getHours() - i);
            
            if (hours <= 24) {
                labels.push(`${i}h ago`);
            } else {
                labels.push(date.toLocaleDateString() + ' ' + date.getHours() + ':00');
            }
        }
        
        return labels;
    }
    
    /**
     * Deep merge objects
     */
    function mergeDeep(target, source) {
        const isObject = (obj) => obj && typeof obj === 'object';
        
        if (!isObject(target) || !isObject(source)) {
            return source;
        }
        
        Object.keys(source).forEach(key => {
            const targetValue = target[key];
            const sourceValue = source[key];
            
            if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
                target[key] = targetValue.concat(sourceValue);
            } else if (isObject(targetValue) && isObject(sourceValue)) {
                target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
            } else {
                target[key] = sourceValue;
            }
        });
        
        return target;
    }
    
    // Clean up on page unload
    window.addEventListener('beforeunload', destroyAllCharts);
    
    // Public API
    return {
        create: createChart,
        update: updateChartData,
        destroy: destroyChart,
        destroyAll: destroyAllCharts,
        get: getChart,
        
        // Specific chart creators
        createChemistryChart,
        createTurbidityChart,
        createHistoryChart,
        
        // Utilities
        generateSampleData,
        generateTimeLabels,
        updateHistoryChartAxisVisibility
    };
})();

// Make ChartManager globally available
window.ChartManager = ChartManager;